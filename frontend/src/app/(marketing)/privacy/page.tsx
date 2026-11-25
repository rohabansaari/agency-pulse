import { Clause, LEGAL, LegalDoc } from "@/components/marketing/LegalDoc";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — AgencyPulse",
  description: "What AgencyPulse records, why, who can see it, how long it is kept, and the choices people have.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="25 November 2026"
      intro={
        <p>
          AgencyPulse is software that companies use to track working time, run payroll and bill clients. The short version:
          we only record screenshots and activity <strong>while a timer is running</strong>, we never record what you type,
          screenshots are deleted after 60 days, and salaries are visible only to admins with the payroll PIN.
        </p>
      }
    >
      <Clause id="who" title="1. Who we are and our role">
        <p>
          This policy covers the AgencyPulse website and app, operated by {LEGAL.company}, {LEGAL.city}{" "}
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;).
        </p>
        <p>
          When a company (&ldquo;the customer&rdquo;) uses AgencyPulse for its team, <strong>the customer decides</strong>{" "}
          what is tracked and who sees it, and is responsible for that data. We process it on the customer&rsquo;s behalf and
          only to run the service. If you are an employee with a question about your data, ask your employer first; you can
          also contact us.
        </p>
      </Clause>

      <Clause id="collect" title="2. What we collect">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>When and how</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Account details</td>
              <td>Name, work email, role, team and password (stored hashed). Entered by you or your admin.</td>
            </tr>
            <tr>
              <td>Time records</td>
              <td>Timer start, pause and stop times, projects, manual time, leave and overtime requests.</td>
            </tr>
            <tr>
              <td>Screenshots</td>
              <td>
                Taken by the desktop agent about every 5 minutes, <strong>only while your timer is running</strong>. The tray
                icon shows when the agent is on.
              </td>
            </tr>
            <tr>
              <td>Activity level</td>
              <td>
                How many seconds in each window had keyboard or mouse input. We do <strong>not</strong> record which keys you
                press, what you type, your passwords, or the content of your microphone or camera.
              </td>
            </tr>
            <tr>
              <td>Idle time</td>
              <td>When there has been no input for the period your company sets, the timer pauses and you choose what to keep.</td>
            </tr>
            <tr>
              <td>Pay data</td>
              <td>
                Salary, deductions, advances and payslips, entered by your company&rsquo;s admins and protected by a payroll
                PIN.
              </td>
            </tr>
            <tr>
              <td>Client and invoice data</td>
              <td>Client names, project rates and invoices that your company creates.</td>
            </tr>
            <tr>
              <td>Technical data</td>
              <td>IP address, browser and device details, and logs needed to keep the service secure and working.</td>
            </tr>
          </tbody>
        </table>
        <p>We do not use advertising trackers and we do not sell personal data.</p>
      </Clause>

      <Clause id="use" title="3. How the data is used">
        <ul>
          <li>To record working time and show it to you and the people your company allows.</li>
          <li>To calculate payroll, payslips, project costs and client invoices for your company.</li>
          <li>To send service emails, such as invitations, password resets and &ldquo;your payslip is ready&rdquo;.</li>
          <li>To keep the service secure, prevent abuse and fix problems.</li>
          <li>
            To write the optional AI weekly summary for admins and managers. Only totals are sent to the AI provider (hours,
            activity percentages, approvals and alerts) &mdash; never screenshots, salaries or email addresses.
          </li>
        </ul>
      </Clause>

      <Clause id="see" title="4. Who can see what">
        <ul>
          <li>You can see your own time, activity, screenshots and payslips.</li>
          <li>Managers can see the time, activity and screenshots of the teams they manage.</li>
          <li>Admins can see everyone in their company. Salaries and payslips also need the payroll PIN.</li>
          <li>
            Our staff access customer data only when needed to support the customer, fix a problem, or when the law requires
            it.
          </li>
        </ul>
      </Clause>

      <Clause id="providers" title="5. Service providers">
        <p>We use these providers to run AgencyPulse. Each only receives what it needs for its job.</p>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Vercel</td>
              <td>Hosting the website and app</td>
            </tr>
            <tr>
              <td>Neon</td>
              <td>Database</td>
            </tr>
            <tr>
              <td>Cloudflare (R2)</td>
              <td>Screenshot storage</td>
            </tr>
            <tr>
              <td>Brevo</td>
              <td>Sending service emails</td>
            </tr>
            <tr>
              <td>Google (Gemini) or Anthropic (Claude)</td>
              <td>Writing the optional AI weekly summary from totals</td>
            </tr>
          </tbody>
        </table>
        <p>
          These providers run servers outside Pakistan, mainly in the United States, so your data may be stored and processed
          there. We choose providers that protect data with encryption and access controls.
        </p>
      </Clause>

      <Clause id="retention" title="6. How long we keep data">
        <ul>
          <li>Screenshots are deleted automatically after 60 days.</li>
          <li>
            Time, payroll and invoice records are kept while the company&rsquo;s account is active, because companies need them
            for pay and tax records.
          </li>
          <li>
            When a company closes its account, we delete its data within 90 days, unless the law requires us to keep part of
            it longer.
          </li>
        </ul>
      </Clause>

      <Clause id="security" title="7. Security">
        <p>
          Data is encrypted in transit (HTTPS). Passwords are hashed, payroll needs a separate PIN, and each company&rsquo;s
          data is kept separate from every other company&rsquo;s. No system is perfectly secure; if a breach affects your data
          we will tell the affected customers without undue delay.
        </p>
      </Clause>

      <Clause id="rights" title="8. Your choices and rights">
        <ul>
          <li>You can see your own records in the app at any time.</li>
          <li>
            You can ask for a copy of your data, or for wrong data to be corrected or deleted. Because your employer controls
            work records, we will usually pass the request to them, and some records (such as pay records) may need to be kept.
          </li>
          <li>Screenshots and activity are only recorded while you run a timer. Stop the timer and recording stops.</li>
        </ul>
        <p>
          Write to <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> and we will reply within 30 days.
        </p>
      </Clause>

      <Clause id="children" title="9. Children">
        <p>AgencyPulse is a workplace tool and is not meant for anyone under 18.</p>
      </Clause>

      <Clause id="changes" title="10. Changes">
        <p>
          If we change this policy in a way that matters, we will update the date above and ask people to read and accept the
          new version in the app. See also our <Link href="/terms">Terms of Service</Link>.
        </p>
      </Clause>

      <Clause id="contact" title="11. Contact">
        <p>
          {LEGAL.company}, {LEGAL.city} &middot; <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
        </p>
      </Clause>
    </LegalDoc>
  );
}
