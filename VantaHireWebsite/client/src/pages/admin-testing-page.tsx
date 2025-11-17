import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  Zap,
  Globe,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Activity
} from "lucide-react";
import Layout from "@/components/Layout";
import { getCsrfToken } from "@/lib/csrf";

interface TestResult {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  details?: string;
  coverage?: number;
}

interface TestSuite {
  id: string;
  name: string;
  description: string;
  icon: any;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  coverage: number;
}

export default function AdminTestingPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Initialize test suites
    setTestSuites([
      {
        id: 'unit',
        name: 'Unit Tests',
        description: 'Component and function testing',
        icon: CheckCircle,
        tests: [
          { id: 'button', name: 'Button Component', status: 'pending' },
          { id: 'header', name: 'Header Component', status: 'pending' },
          { id: 'forms', name: 'Form Components', status: 'pending' },
          { id: 'utils', name: 'Utility Functions', status: 'pending' },
          { id: 'hooks', name: 'Custom Hooks', status: 'pending' }
        ],
        totalTests: 5,
        passedTests: 0,
        failedTests: 0,
        coverage: 0
      },
      {
        id: 'integration',
        name: 'Integration Tests',
        description: 'API endpoint validation',
        icon: Globe,
        tests: [
          { id: 'jobs-api', name: 'Jobs API', status: 'pending' },
          { id: 'auth-api', name: 'Authentication API', status: 'pending' },
          { id: 'admin-api', name: 'Admin API', status: 'pending' },
          { id: 'applications-api', name: 'Applications API', status: 'pending' },
          { id: 'ai-api', name: 'AI Analysis API', status: 'pending' }
        ],
        totalTests: 5,
        passedTests: 0,
        failedTests: 0,
        coverage: 0
      },
      {
        id: 'e2e',
        name: 'E2E Tests',
        description: 'Complete user workflows',
        icon: Activity,
        tests: [
          { id: 'job-flow', name: 'Job Application Flow', status: 'pending' },
          { id: 'recruiter-flow', name: 'Recruiter Workflow', status: 'pending' },
          { id: 'admin-flow', name: 'Admin Workflow', status: 'pending' },
          { id: 'mobile', name: 'Mobile Responsiveness', status: 'pending' },
          { id: 'accessibility', name: 'Accessibility Tests', status: 'pending' }
        ],
        totalTests: 5,
        passedTests: 0,
        failedTests: 0,
        coverage: 0
      },
      {
        id: 'security',
        name: 'Security Tests',
        description: 'Authentication and validation',
        icon: Shield,
        tests: [
          { id: 'auth-security', name: 'Authentication Security', status: 'pending' },
          { id: 'input-validation', name: 'Input Validation', status: 'pending' },
          { id: 'rate-limiting', name: 'Rate Limiting', status: 'pending' },
          { id: 'sql-injection', name: 'SQL Injection Prevention', status: 'pending' },
          { id: 'session-security', name: 'Session Security', status: 'pending' }
        ],
        totalTests: 5,
        passedTests: 0,
        failedTests: 0,
        coverage: 0
      },
      {
        id: 'performance',
        name: 'Performance Tests',
        description: 'Load and stress testing',
        icon: Zap,
        tests: [
          { id: 'load-test', name: 'Load Testing (200 users)', status: 'pending' },
          { id: 'api-performance', name: 'API Response Times', status: 'pending' },
          { id: 'ai-performance', name: 'AI Analysis Performance', status: 'pending' },
          { id: 'rate-limits', name: 'Rate Limit Validation', status: 'pending' },
          { id: 'stress-test', name: 'Stress Testing', status: 'pending' }
        ],
        totalTests: 5,
        passedTests: 0,
        failedTests: 0,
        coverage: 0
      }
    ]);
  }, []);

  const runTestSuite = async (suiteId: string) => {
    const suite = testSuites.find(s => s.id === suiteId);
    if (!suite) return;

    // Update suite status to running
    setTestSuites(prev => prev.map(s =>
      s.id === suiteId
        ? { ...s, tests: s.tests.map(t => ({ ...t, status: 'running' as const })) }
        : s
    ));

    try {
      // Get CSRF token for security
      const csrf = await getCsrfToken();

      // Call real backend API
      const response = await fetch('/api/admin/run-tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf,
        },
        credentials: 'include',
        body: JSON.stringify({ suite: suiteId }),
      });

      if (!response.ok) {
        throw new Error(`Test execution failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Update suite with real results
      setTestSuites(prev => prev.map(s =>
        s.id === suiteId
          ? {
              ...s,
              tests: result.tests.map((t: any) => ({
                id: t.id,
                name: t.name,
                status: t.status,
                duration: t.duration,
                details: t.details,
              })),
              totalTests: result.totalTests,
              passedTests: result.passedTests,
              failedTests: result.failedTests,
              coverage: result.coverage || s.coverage,
            }
          : s
      ));
    } catch (error) {
      console.error('Test execution error:', error);

      // Mark all tests as failed on error
      setTestSuites(prev => prev.map(s =>
        s.id === suiteId
          ? {
              ...s,
              tests: s.tests.map(t => ({
                ...t,
                status: 'failed' as const,
                details: error instanceof Error ? error.message : 'Test execution failed',
              })),
              passedTests: 0,
              failedTests: s.totalTests,
            }
          : s
      ));
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    setOverallProgress(0);

    for (let i = 0; i < testSuites.length; i++) {
      const suite = testSuites[i];
      if (suite) {
        await runTestSuite(suite.id);
      }
      setOverallProgress(((i + 1) / testSuites.length) * 100);
    }

    setIsRunningAll(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'bg-green-50 text-green-700 border-green-200';
      case 'failed': return 'bg-red-50 text-red-700 border-red-200';
      case 'running': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const totalTests = testSuites.reduce((acc, suite) => acc + suite.totalTests, 0);
  const totalPassed = testSuites.reduce((acc, suite) => acc + suite.passedTests, 0);
  const totalFailed = testSuites.reduce((acc, suite) => acc + suite.failedTests, 0);
  const averageCoverage = testSuites.reduce((acc, suite) => acc + suite.coverage, 0) / testSuites.length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-12 pt-8">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
              Testing Dashboard
            </h1>
          </div>
          <p className="text-lg text-slate-500 max-w-2xl">
            Run and monitor comprehensive test suites for the VantaHire platform
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Tests</p>
                  <p className="text-2xl font-bold text-slate-900">{totalTests}</p>
                </div>
                <Activity className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Passed</p>
                  <p className="text-2xl font-bold text-green-600">{totalPassed}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{totalFailed}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Coverage</p>
                  <p className="text-2xl font-bold text-blue-600">{Math.round(averageCoverage)}%</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

          {/* Run All Tests */}
          <Card className="shadow-sm mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-slate-900">Test Execution</CardTitle>
                  <CardDescription className="text-slate-900/70">
                    Run comprehensive test suites for the entire platform
                  </CardDescription>
                </div>
                <Button 
                  onClick={runAllTests}
                  disabled={isRunningAll}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isRunningAll ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Running Tests...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run All Tests
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            {isRunningAll && (
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-900/70">
                    <span>Overall Progress</span>
                    <span>{Math.round(overallProgress)}%</span>
                  </div>
                  <Progress value={overallProgress} className="h-2" />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Test Suites */}
          <Tabs defaultValue="unit" className="space-y-6">
            <TabsList className="bg-slate-50 border-slate-200">
              {testSuites.map((suite) => (
                <TabsTrigger 
                  key={suite.id} 
                  value={suite.id}
                  className="text-slate-900 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <suite.icon className="h-4 w-4 mr-2" />
                  {suite.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {testSuites.map((suite) => (
              <TabsContent key={suite.id} value={suite.id}>
                <Card className="shadow-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-slate-900 flex items-center gap-2">
                          <suite.icon className="h-5 w-5 text-primary" />
                          {suite.name}
                        </CardTitle>
                        <CardDescription className="text-slate-900/70">
                          {suite.description}
                        </CardDescription>
                      </div>
                      <Button 
                        onClick={() => runTestSuite(suite.id)}
                        variant="outline"
                        className="border-slate-300 text-slate-700 hover:bg-slate-100"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Run Suite
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="text-center">
                        <p className="text-sm text-slate-900/70">Total</p>
                        <p className="text-xl font-bold text-slate-900">{suite.totalTests}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-slate-900/70">Passed</p>
                        <p className="text-xl font-bold text-green-600">{suite.passedTests}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-slate-900/70">Coverage</p>
                        <p className="text-xl font-bold text-blue-600">{suite.coverage}%</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3">
                      {suite.tests.map((test) => (
                        <div 
                          key={test.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200"
                        >
                          <div className="flex items-center gap-3">
                            {getStatusIcon(test.status)}
                            <div>
                              <p className="text-slate-900 font-medium">{test.name}</p>
                              {test.details && (
                                <p className="text-xs text-slate-900/60">{test.details}</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {test.duration && (
                              <span className="text-xs text-slate-900/60">
                                {test.duration}ms
                              </span>
                            )}
                            <Badge className={getStatusColor(test.status)}>
                              {test.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Test Commands */}
          <Card className="shadow-sm mt-8">
            <CardHeader>
              <CardTitle className="text-slate-900">Manual Test Commands</CardTitle>
              <CardDescription className="text-slate-900/70">
                Run these commands in your terminal to execute specific test suites
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-slate-900 font-medium">Unit Tests</h4>
                  <code className="block p-2 bg-slate-800 rounded text-green-600 text-sm">
                    npm test test/unit
                  </code>
                </div>
                <div className="space-y-2">
                  <h4 className="text-slate-900 font-medium">Integration Tests</h4>
                  <code className="block p-2 bg-slate-800 rounded text-green-600 text-sm">
                    npm test test/integration
                  </code>
                </div>
                <div className="space-y-2">
                  <h4 className="text-slate-900 font-medium">E2E Tests</h4>
                  <code className="block p-2 bg-slate-800 rounded text-green-600 text-sm">
                    npm test test/e2e
                  </code>
                </div>
                <div className="space-y-2">
                  <h4 className="text-slate-900 font-medium">Security Tests</h4>
                  <code className="block p-2 bg-slate-800 rounded text-green-600 text-sm">
                    npm run test:security
                  </code>
                </div>
                <div className="space-y-2">
                  <h4 className="text-slate-900 font-medium">Performance Tests</h4>
                  <code className="block p-2 bg-slate-800 rounded text-green-600 text-sm">
                    npm run test:load:smoke
                  </code>
                </div>
                <div className="space-y-2">
                  <h4 className="text-slate-900 font-medium">Load Tests (Full)</h4>
                  <code className="block p-2 bg-slate-800 rounded text-green-600 text-sm">
                    npm run test:load
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
    </Layout>
  );
}