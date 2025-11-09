import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, Shield, AlertTriangle, Scale, Ban } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-10 h-10 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">Terms of Service</h1>
          </div>
          <p className="text-slate-400 text-lg">
            Last Updated: January 2025
          </p>
        </div>

        <div className="space-y-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-400" />
                Agreement to Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                These Terms of Service ("Terms") govern your access to and use of VantaHire, an applicant
                tracking system and recruitment platform operated by Deori RecruiterHub Solutions OPC Pvt Ltd
                ("VantaHire," "we," "us," or "our").
              </p>
              <p>
                By accessing or using VantaHire, you agree to be bound by these Terms. If you do not agree
                to these Terms, you may not access or use our services.
              </p>
              <p>
                We reserve the right to modify these Terms at any time. Continued use of our services after
                changes constitutes acceptance of the modified Terms.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                User Accounts and Roles
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <div>
                <h3 className="text-white font-semibold mb-2">Account Types</h3>
                <p className="mb-2">VantaHire offers different account types:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Candidates:</strong> Individuals seeking employment who can apply to job postings</li>
                  <li><strong>Recruiters:</strong> Professionals who post jobs and manage applications</li>
                  <li><strong>Administrators:</strong> Users with elevated permissions to manage the platform</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2">Account Registration</h3>
                <p>To use VantaHire, you must:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Be at least 18 years of age</li>
                  <li>Provide accurate and complete registration information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Notify us immediately of any unauthorized access</li>
                  <li>Be responsible for all activities under your account</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2">Account Termination</h3>
                <p>
                  We reserve the right to suspend or terminate your account at any time for violation of
                  these Terms, fraudulent activity, or any other reason we deem appropriate.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Acceptable Use</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>You agree to use VantaHire only for lawful purposes. You may not:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on intellectual property rights of others</li>
                <li>Submit false, misleading, or fraudulent information</li>
                <li>Upload malicious code, viruses, or harmful content</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Scrape, harvest, or collect user data without permission</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Use automated systems (bots) to access our services</li>
                <li>Reverse engineer or decompile our platform</li>
                <li>Resell or redistribute our services without authorization</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Content and Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <div>
                <h3 className="text-white font-semibold mb-2">Your Content</h3>
                <p>
                  You retain ownership of content you submit to VantaHire (resumes, applications, job postings, etc.).
                  By submitting content, you grant us a non-exclusive, worldwide, royalty-free license to use,
                  store, and display your content for the purpose of providing our services.
                </p>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2">Our Content</h3>
                <p>
                  VantaHire's platform, design, features, and functionality are owned by Deori RecruiterHub
                  Solutions OPC Pvt Ltd and are protected by copyright, trademark, and other intellectual
                  property laws. You may not copy, modify, or distribute our content without permission.
                </p>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2">AI-Generated Content</h3>
                <p>
                  AI-generated fit scores, recommendations, and analysis are provided for informational
                  purposes only. We do not guarantee their accuracy and they should not be the sole basis
                  for hiring decisions.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Job Postings and Applications</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <div>
                <h3 className="text-white font-semibold mb-2">For Recruiters</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Job postings must be accurate and comply with employment laws</li>
                  <li>You may not post discriminatory job listings</li>
                  <li>You are responsible for reviewing applications and making hiring decisions</li>
                  <li>You must handle candidate data in compliance with privacy laws</li>
                  <li>You may not use VantaHire for unlawful recruitment practices</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2">For Candidates</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Applications must contain truthful and accurate information</li>
                  <li>You may not submit fraudulent credentials or resumes</li>
                  <li>You understand that applying does not guarantee employment</li>
                  <li>You authorize recruiters to view and download your application materials</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Payment and Subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                VantaHire may offer paid features or subscription plans in the future. If you purchase
                a subscription:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Fees are non-refundable except as required by law</li>
                <li>Subscriptions auto-renew unless cancelled</li>
                <li>We may change pricing with advance notice</li>
                <li>You are responsible for maintaining valid payment information</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                Disclaimers and Limitations
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <div>
                <h3 className="text-white font-semibold mb-2">No Warranty</h3>
                <p>
                  VantaHire is provided "as is" without warranties of any kind, either express or implied.
                  We do not guarantee that our services will be uninterrupted, error-free, or secure.
                </p>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2">Limitation of Liability</h3>
                <p>
                  To the maximum extent permitted by law, Deori RecruiterHub Solutions OPC Pvt Ltd shall
                  not be liable for any indirect, incidental, special, consequential, or punitive damages
                  arising from your use of VantaHire.
                </p>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2">Third-Party Services</h3>
                <p>
                  VantaHire may integrate with third-party services (Google Cloud, OpenAI, etc.).
                  We are not responsible for the availability or content of third-party services.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Indemnification</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                You agree to indemnify and hold harmless Deori RecruiterHub Solutions OPC Pvt Ltd,
                its officers, directors, employees, and agents from any claims, damages, losses, or
                expenses arising from:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Your violation of these Terms</li>
                <li>Your violation of any law or regulation</li>
                <li>Your infringement of third-party rights</li>
                <li>Your use of VantaHire</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Governing Law and Disputes</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                These Terms are governed by the laws of India. Any disputes arising from these Terms or
                your use of VantaHire shall be resolved through binding arbitration in accordance with
                Indian arbitration laws.
              </p>
              <p>
                You agree to waive any right to a jury trial or to participate in a class action lawsuit.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Severability</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                If any provision of these Terms is found to be unenforceable or invalid, that provision
                will be limited or eliminated to the minimum extent necessary, and the remaining provisions
                will remain in full force and effect.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                If you have questions about these Terms of Service, please contact us:
              </p>
              <div className="bg-slate-800 p-4 rounded-lg space-y-2">
                <p><strong className="text-white">Deori RecruiterHub Solutions OPC Pvt Ltd</strong></p>
                <p>Email: legal@vantahire.com</p>
                <p>Subject: Terms of Service Inquiry</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
