import { Crop, CtaBand, Heading, Notes, PageIntro, Section, Shot, Split, vars } from "@/components/marketing/parts";
import ready from "@/components/marketing/img/crop-ready.webp";
import invoiceDetail from "@/components/marketing/img/invoice-detail.webp";
import invoices from "@/components/marketing/img/invoices.webp";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client invoicing — AgencyPulse",
  description:
    "Invoice clients from approved hours and fixed fees. Every hour is billed once, with drafts, part payments, overdue tracking and print-ready PDFs.",
};

const STEPS = [
  ["Hours approved", "A manager signs off the week's time."],
  ["Ready to invoice", "Unbilled work waits, grouped by client."],
  ["Draft", "Edit lines, add expenses, set tax and due date."],
  ["Sent", "Print or save as PDF, then mark it sent."],
  ["Paid", "Record payments until the balance is zero."],
];

export default function InvoicingMarketingPage() {
  return (
    <>
      <PageIntro
        eyebrow="Client invoicing"
        title="Bill clients from hours someone approved."
        lead="The hours your team tracked and your managers approved become the invoice. Hourly work at the project rate, fixed fees for what's left of the budget, and nothing billed twice."
      />

      <section className="mk-pad">
        <div className="mk-wrap">
          <Shot
            src={invoices}
            alt="Invoices: Rs. 951,820 ready to invoice, Rs. 1,417,360 outstanding, Rs. 255,360 overdue, and a list of draft, sent, part-paid, overdue and paid invoices"
            path="/invoices"
            pins={[
              [37, 15],
              [86, 29],
              [70, 15],
              [83.5, 69],
            ]}
            delay={900}
            priority
          />
          <div className="mk-g4" style={{ gap: 32, marginTop: 40 }}>
            <Notes
              items={[
                ["Ready to invoice", "Approved work no invoice has billed yet, priced at each project's rate."],
                ["One click per client", "Create the invoice and its hours are marked as billed, so they can't go out twice."],
                ["Overdue, in red", "Anything past its due date is flagged, with how many days late."],
                ["Part payments", "Record what arrived. The invoice stays open until the balance is zero."],
              ]}
            />
          </div>
        </div>
      </section>

      <Section>
        <Heading eyebrow="From timesheet to paid" title="Five steps, and the first one already happened." center />
        <ol className="mk-g4 mk-steps" style={{ gridTemplateColumns: "repeat(5,minmax(0,1fr))", listStyle: "none", padding: 0, margin: "56px 0 0" }}>
          {STEPS.map(([title, text], index) => (
            <li
              key={title}
              className="mk-rv"
              style={vars({
                "--d": `${index * 160}ms`,
                "--i": index,
                padding: "28px 24px",
                background: index === STEPS.length - 1 ? "var(--primary-muted)" : "transparent",
              })}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--primary)" }}>Step {index + 1}</div>
              <div style={{ marginTop: 10, fontWeight: 600, fontSize: 18 }}>{title}</div>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 15, lineHeight: 1.55 }}>{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <Split columns="minmax(0,7fr) minmax(0,5fr)">
          <Shot
            src={invoiceDetail}
            alt="Invoice INV-0003 to Hooli Pay: a Rs. 1,200,000 fixed fee and a Rs. 12,000 expense, Rs. 50,000 paid, Rs. 1,162,000 due"
            path="/invoices/3"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Heading eyebrow="The invoice" title="Your name on it, ready to print." />
            <div>
              <Notes
                items={[
                  ["Your details", "Business name, address, tax ID and bank details, set once."],
                  ["Print or PDF", "A clean page with no app around it, straight from the browser."],
                  ["Mistakes undone", "Void an unpaid invoice and its hours go back to ready to invoice."],
                ]}
              />
            </div>
          </div>
        </Split>
      </Section>

      <Section>
        <Split columns="minmax(0,5fr) minmax(0,7fr)">
          <Heading
            eyebrow="Fixed fees too"
            title="Fixed-fee projects bill what's left of the fee."
            lead="Split a fixed fee across milestones. Each invoice takes what earlier ones haven't, so the total never goes over the agreed price."
          />
          <Crop src={ready} alt="Ready to invoice: Globex Telecom Rs. 450,000, Umbrella Pharma Rs. 279,500, Initech Bank Rs. 222,320, each with a Create invoice button" />
        </Split>
      </Section>

      <CtaBand />
    </>
  );
}
