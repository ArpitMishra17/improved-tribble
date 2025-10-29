import type { Express, Request, Response, NextFunction } from "express";
import { requireRole } from "./auth";
import rateLimit from "express-rate-limit";
import { spawn } from "child_process";
import path from "path";

// Rate limit test execution to prevent abuse
const testRunnerRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 test runs per 5 minutes
  message: { error: "Test execution limit reached. Please wait before running more tests." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip || 'anonymous',
});

interface TestResult {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  details?: string;
}

interface TestSuiteResult {
  suite: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  coverage?: number;
  tests: TestResult[];
  rawOutput: string;
}

// Parse vitest output
function parseVitestOutput(output: string): TestResult[] {
  const tests: TestResult[] = [];
  const lines = output.split('\n');

  let testId = 0;
  for (const line of lines) {
    // Match test pass: ✓ test/unit/button.test.tsx (1)
    if (line.includes('✓') && line.includes('.test.')) {
      tests.push({
        id: `test-${testId++}`,
        name: line.trim().replace('✓', '').trim(),
        status: 'passed',
      });
    }
    // Match test fail: ✗ test/unit/button.test.tsx (1)
    else if (line.includes('✗') && line.includes('.test.')) {
      tests.push({
        id: `test-${testId++}`,
        name: line.trim().replace('✗', '').trim(),
        status: 'failed',
      });
    }
  }

  return tests;
}

// Parse security test output
function parseSecurityOutput(output: string): TestResult[] {
  const tests: TestResult[] = [];
  const lines = output.split('\n');

  let testId = 0;
  for (const line of lines) {
    if (line.includes('✓') || line.includes('✗')) {
      const passed = line.includes('✓');
      const name = line.replace(/✓|✗/g, '').trim();

      if (name) {
        tests.push({
          id: `sec-test-${testId++}`,
          name,
          status: passed ? 'passed' : 'failed',
        });
      }
    }
  }

  return tests;
}

// Parse k6 load test output
function parseK6Output(output: string): TestResult[] {
  const tests: TestResult[] = [];

  // Extract key metrics from k6 output
  const metrics = [
    { id: 'http_reqs', name: 'HTTP Requests', pattern: /http_reqs.*?(\d+)/ },
    { id: 'http_req_duration', name: 'Request Duration', pattern: /http_req_duration.*?avg=([\d.]+)ms/ },
    { id: 'http_req_failed', name: 'Failed Requests', pattern: /http_req_failed.*?([\d.]+)%/ },
    { id: 'checks', name: 'Checks Passed', pattern: /✓ checks.*?([\d.]+)%/ },
  ];

  for (const metric of metrics) {
    const match = output.match(metric.pattern);
    if (match) {
      tests.push({
        id: metric.id,
        name: metric.name,
        status: 'passed',
        details: match[0].trim(),
      });
    }
  }

  return tests;
}

// Execute test suite using spawn (safer than exec)
async function runTestSuite(suite: string): Promise<TestSuiteResult> {
  const startTime = Date.now();
  let command: string;
  let args: string[];
  let parser: (output: string) => TestResult[] = parseVitestOutput;

  switch (suite) {
    case 'unit':
      command = 'npm';
      args = ['test', 'test/unit'];
      parser = parseVitestOutput;
      break;
    case 'integration':
      command = 'npm';
      args = ['test', 'test/integration'];
      parser = parseVitestOutput;
      break;
    case 'e2e':
      command = 'npm';
      args = ['test', 'test/e2e'];
      parser = parseVitestOutput;
      break;
    case 'security':
      command = 'npm';
      args = ['run', 'test:security'];
      parser = parseSecurityOutput;
      break;
    case 'performance':
      command = 'npm';
      args = ['run', 'test:load:smoke'];
      parser = parseK6Output;
      break;
    default:
      throw new Error(`Unknown test suite: ${suite}`);
  }

  return new Promise((resolve, reject) => {
    const projectRoot = path.resolve(process.cwd());

    // Spawn process with explicit cwd and env
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        CI: 'true', // Some test runners behave better with CI flag
      },
      shell: false, // Explicitly no shell for security
      timeout: 300000, // 5 minute timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
      // Enforce max buffer
      if (stdout.length > 10 * 1024 * 1024) {
        child.kill('SIGTERM');
        reject(new Error('Output exceeded 10MB buffer limit'));
      }
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > 10 * 1024 * 1024) {
        child.kill('SIGTERM');
        reject(new Error('Error output exceeded 10MB buffer limit'));
      }
    });

    child.on('close', (code) => {
      const output = stdout + stderr;
      const tests = parser(output);
      const duration = Date.now() - startTime;

      // Count pass/fail
      const passedTests = tests.filter(t => t.status === 'passed').length;
      const failedTests = tests.filter(t => t.status === 'failed').length;

      // Extract coverage if available
      let coverage: number | undefined;
      const coverageMatch = output.match(/All files\s*\|\s*([\d.]+)/);
      if (coverageMatch) {
        coverage = parseFloat(coverageMatch[1]);
      }

      // Tests may exit with non-zero code but still have results
      if (code !== 0 && tests.length === 0) {
        resolve({
          suite,
          totalTests: 1,
          passedTests: 0,
          failedTests: 1,
          duration,
          tests: [{
            id: 'error',
            name: 'Test Execution Error',
            status: 'failed',
            details: `Process exited with code ${code}`,
          }],
          rawOutput: output.slice(0, 5000),
        });
      } else {
        resolve({
          suite,
          totalTests: tests.length,
          passedTests,
          failedTests,
          duration,
          coverage,
          tests,
          rawOutput: output.slice(0, 5000), // Limit output size
        });
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to spawn test process: ${error.message}`));
    });
  });
}

export function registerTestRunnerRoutes(
  app: Express,
  csrfProtection?: (req: Request, res: Response, next: NextFunction) => void
): void {
  console.log('🧪 Registering test runner routes...');

  // Use provided CSRF middleware or no-op
  const csrf = csrfProtection || ((req: Request, res: Response, next: NextFunction) => next());

  // Run specific test suite
  app.post(
    "/api/admin/run-tests",
    requireRole(['admin']),
    csrf, // CSRF protection for consistency with other mutating endpoints
    testRunnerRateLimit,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { suite } = req.body;

        if (!suite) {
          return res.status(400).json({ error: 'Test suite is required' });
        }

        const validSuites = ['unit', 'integration', 'e2e', 'security', 'performance'];
        if (!validSuites.includes(suite)) {
          return res.status(400).json({ error: `Invalid test suite. Must be one of: ${validSuites.join(', ')}` });
        }

        console.log(`[TEST RUNNER] Starting ${suite} tests for admin user ${req.user!.id}`);

        const result = await runTestSuite(suite);

        console.log(`[TEST RUNNER] Completed ${suite} tests: ${result.passedTests}/${result.totalTests} passed in ${result.duration}ms`);

        res.json(result);
      } catch (error) {
        console.error('[TEST RUNNER] Error:', error);
        next(error);
      }
    }
  );

  // Get test suite status (lightweight - just checks if tests exist)
  app.get(
    "/api/admin/test-suites",
    requireRole(['admin']),
    async (_req: Request, res: Response) => {
      try {
        res.json({
          suites: [
            {
              id: 'unit',
              name: 'Unit Tests',
              description: 'Component and function testing',
              command: 'npm test test/unit',
              available: true,
            },
            {
              id: 'integration',
              name: 'Integration Tests',
              description: 'API endpoint validation',
              command: 'npm test test/integration',
              available: true,
            },
            {
              id: 'e2e',
              name: 'E2E Tests',
              description: 'Complete user workflows',
              command: 'npm test test/e2e',
              available: true,
            },
            {
              id: 'security',
              name: 'Security Tests',
              description: 'Authentication and validation',
              command: 'npm run test:security',
              available: true,
            },
            {
              id: 'performance',
              name: 'Performance Tests',
              description: 'Load and stress testing (smoke test)',
              command: 'npm run test:load:smoke',
              available: true,
            },
          ],
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch test suites' });
      }
    }
  );
}
