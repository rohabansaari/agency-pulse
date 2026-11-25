import { Clause, LEGAL, LegalDoc } from "@/components/marketing/LegalDoc";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — AgencyPulse",
  description: "The agreement between AgencyPulse and the companies that use it.",
};

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated="25 November 2026"
      intro={
        <p>
          These terms are the agreement between {LEGAL.company} and the company that signs up for AgencyPulse. The person who
          creates the workspace accepts them for that company and confirms they are allowed to do so.
        </p>
      }
    >
      <Clause id="service" title="1. The service">
        <p>
          AgencyPulse provides time tracking, screenshots and activity levels, approvals, leave, payroll, payslips, project
          profitability, client invoicing and optional AI summaries (&ldquo;the service&rdquo;), through the website, the web
          app and the Windows desktop agent. We may improve or change features over time; we will not remove a core feature
          you pay for without notice.
        </p>
      </Clause>

      <Clause id="accounts" title="2. Accounts">
        <ul>
          <li>You are responsible for the people you invite, the roles you give them, and keeping passwords and the payroll PIN safe.</li>
          <li>Tell us straight away if you think an account has been misused.</li>
          <li>Users must be at least 18 years old.</li>
        </ul>
      </Clause>

      <Clause id="monitoring" title="3. Your responsibilities for monitoring">
        <p>Screenshots and activity tracking are powerful. As the employer, you agree to:</p>
        <ul>
          <li>Tell your employees, in writing, that time, activity levels and screenshots are recorded while their timer runs, and why.</li>
          <li>Use the service only for legitimate work purposes, and follow the employment, privacy and data laws that apply to you and your staff.</li>
          <li>Not use AgencyPulse to secretly watch anyone, or on personal devices without the owner&rsquo;s agreement.</li>
        </ul>
        <p>
          Each person also sees and accepts our monitoring notice in the app before their first timer. That notice does not
          replace your own duty to inform and, where needed, get consent from your staff.
        </p>
      </Clause>

      <Clause id="payroll" title="4. Payroll, tax and invoices">
        <p>
          AgencyPulse calculates pay, deductions and invoices from the rates, percentages and records you enter. You are
          responsible for checking them before paying anyone or sending an invoice, and for your tax, EOBI and other legal
          filings. AgencyPulse is not a tax, legal or accounting adviser.
        </p>
      </Clause>

      <Clause id="fees" title="5. Trial, fees and payment">
        <ul>
          <li>New workspaces start with a free trial. We will tell you before the trial ends.</li>
          <li>
            After the trial, fees are charged per person who tracks time, at the prices on our{" "}
            <Link href="/pricing">pricing page</Link> or in your quote.
          </li>
          <li>Invoices are due within 15 days. If payment is more than 30 days late, we may pause the workspace after giving notice.</li>
          <li>We will give at least 30 days&rsquo; notice before a price increase.</li>
          <li>Fees already paid are not refunded, except where the law requires or we agree in writing.</li>
        </ul>
      </Clause>

      <Clause id="data" title="6. Your data">
        <p>
          You own the data you and your team put into AgencyPulse. You give us permission to store and process it only to
          provide and support the service, as described in our <Link href="/privacy">Privacy Policy</Link>. You can export
          your reports at any time. After you close your account, we delete your data within 90 days unless the law requires
          us to keep it.
        </p>
      </Clause>

      <Clause id="use" title="7. Acceptable use">
        <p>You must not:</p>
        <ul>
          <li>Break the law, or record anyone in a way the law does not allow.</li>
          <li>Try to access other companies&rsquo; data, or test, probe or overload our systems without permission.</li>
          <li>Copy, resell or reverse engineer the service, except where the law allows.</li>
          <li>Upload malware or content you have no right to use.</li>
        </ul>
      </Clause>

      <Clause id="availability" title="8. Availability and support">
        <p>
          We work to keep AgencyPulse available and back up its data, but we cannot promise it will always be uninterrupted or
          error-free. Planned maintenance will be announced where possible. Support is by email at{" "}
          <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
        </p>
      </Clause>

      <Clause id="liability" title="9. Limits of liability">
        <p>
          To the extent the law allows, the service is provided &ldquo;as is&rdquo;, and we are not liable for indirect or
          consequential losses such as lost profits or lost data. Our total liability for any claim is limited to the fees you
          paid us in the 12 months before the claim. Nothing in these terms limits liability that cannot be limited by law.
        </p>
      </Clause>

      <Clause id="ending" title="10. Ending the agreement">
        <p>
          You can stop using AgencyPulse at any time; tell us and we will close the workspace at the end of the paid period. We
          may suspend or close a workspace that seriously breaks these terms, after notice where reasonable.
        </p>
      </Clause>

      <Clause id="changes" title="11. Changes to these terms">
        <p>
          If we change these terms in a way that matters, we will update the date above and ask admins to accept the new
          version in the app. If you do not agree, you can close your account.
        </p>
      </Clause>

      <Clause id="law" title="12. Law and disputes">
        <p>
          These terms are governed by the laws of Pakistan. We will first try to settle any dispute by talking. If that fails,
          the courts of Lahore will decide it.
        </p>
      </Clause>

      <Clause id="contact" title="13. Contact">
        <p>
          {LEGAL.company}, {LEGAL.city} &middot; <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
        </p>
      </Clause>
    </LegalDoc>
  );
}
