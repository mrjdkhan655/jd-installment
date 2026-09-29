import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

/**
 * Professional agreement templates for Car / Gold / Other products.
 * Layout follows the structure of the business's existing Word
 * agreement: parties, asset specification, dynamically generated
 * payment schedule, terms, and signature blocks.
 */

const s = StyleSheet.create({
  page: { padding: 44, fontSize: 9.5, fontFamily: "Helvetica", color: "#111418", lineHeight: 1.5 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 3 },
  subtitle: { fontSize: 9, textAlign: "center", color: "#666666", marginBottom: 16 },
  meta: {
    flexDirection: "row", justifyContent: "space-between", marginBottom: 16,
    borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6,
    textTransform: "uppercase", letterSpacing: 0.6, color: "#0f4c3a",
  },
  row: { flexDirection: "row", marginBottom: 2.5 },
  label: { width: 120, color: "#666666" },
  value: { flex: 1, fontFamily: "Helvetica-Bold" },
  twoCol: { flexDirection: "row" },
  col: { flex: 1, paddingRight: 16 },
  table: { borderWidth: 1, borderColor: "#e5e7eb", marginTop: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  trLast: { flexDirection: "row" },
  th: { padding: 5, fontFamily: "Helvetica-Bold", fontSize: 8.5, backgroundColor: "#f7f8fa" },
  td: { padding: 5, fontSize: 8.5 },
  cNum: { width: "12%" },
  cDate: { width: "28%" },
  cDesc: { width: "35%" },
  cAmt: { width: "25%", textAlign: "right" },
  totalRow: { flexDirection: "row", backgroundColor: "#f7f8fa", borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  term: { flexDirection: "row", marginBottom: 3 },
  termNum: { width: 16 },
  termText: { flex: 1 },
  signatures: { flexDirection: "row", marginTop: 36 },
  sigBlock: { flex: 1, paddingRight: 30 },
  sigLine: { borderTopWidth: 1, borderTopColor: "#111418", marginTop: 34, paddingTop: 4 },
  footer: {
    position: "absolute", bottom: 26, left: 44, right: 44, fontSize: 7.5,
    color: "#999999", textAlign: "center", borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 6,
  },
});

export interface AgreementData {
  kind: "car" | "gold" | "other";
  contractNumber: string;
  agreementDate: string;
  location: string;
  seller: { name: string; address?: string; phone?: string; email?: string };
  buyer: { name: string; customerCode: string; phone?: string; governmentId?: string; address?: string };
  asset: { label: string; value: string }[];
  totalAmount: string;
  downPayment: string;
  financedAmount: string;
  durationLabel: string;
  startDate: string;
  endDate: string;
  schedule: { number: number; dueDate: string; description: string; amount: string }[];
  penalty: string;
  notes?: string;
  logoPath?: string;
}

const TITLES: Record<AgreementData["kind"], string> = {
  car: "VEHICLE SALE & INSTALLMENT AGREEMENT",
  gold: "GOLD SALE & INSTALLMENT AGREEMENT",
  other: "PRODUCT SALE & INSTALLMENT AGREEMENT",
};

function Line({ label, value }: { label: string; value?: string }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value || "—"}</Text>
    </View>
  );
}

export function AgreementDocument({ data }: { data: AgreementData }) {
  const terms = buildTerms(data);
  const dpNum = parseFloat(data.downPayment.replace(/[^0-9.]/g, "") || "0");

  return (
    <Document title={`Agreement ${data.contractNumber}`}>
      <Page size="A4" style={s.page}>
        {data.logoPath && (
          <Image
            src={data.logoPath}
            style={{ width: 130, height: 44, alignSelf: "center", marginBottom: 6, objectFit: "contain" }}
          />
        )}
        <Text style={s.title}>{TITLES[data.kind]}</Text>
        <Text style={s.subtitle}>{data.seller.name} · Contract Reference: {data.contractNumber}</Text>

        <View style={s.meta}>
          <Text>Date: {data.agreementDate}</Text>
          <Text>Location: {data.location}</Text>
        </View>

        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={s.sectionTitle}>Seller</Text>
            <Line label="Name" value={data.seller.name} />
            <Line label="Address" value={data.seller.address} />
            <Line label="Phone" value={data.seller.phone} />
            <Line label="Email" value={data.seller.email} />
          </View>
          <View style={s.col}>
            <Text style={s.sectionTitle}>Buyer</Text>
            <Line label="Name" value={data.buyer.name} />
            <Line label="Customer ID" value={data.buyer.customerCode} />
            <Line label="Government ID" value={data.buyer.governmentId} />
            <Line label="Phone" value={data.buyer.phone} />
            <Line label="Address" value={data.buyer.address} />
          </View>
        </View>

        <Text style={s.sectionTitle}>Asset Specification</Text>
        {data.asset.map((a) => (
          <Line key={a.label} label={a.label} value={a.value} />
        ))}

        <Text style={s.sectionTitle}>Agreement Duration & Value</Text>
        <View style={s.twoCol}>
          <View style={s.col}>
            <Line label="Total Agreed" value={data.totalAmount} />
            <Line label="Down Payment" value={data.downPayment} />
            <Line label="Financed Amount" value={data.financedAmount} />
          </View>
          <View style={s.col}>
            <Line label="Duration" value={data.durationLabel} />
            <Line label="Start Date" value={data.startDate} />
            <Line label="Completion Date" value={data.endDate} />
          </View>
        </View>

        <Text style={s.sectionTitle}>Payment Schedule</Text>
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, s.cNum]}>No.</Text>
            <Text style={[s.th, s.cDate]}>Due Date</Text>
            <Text style={[s.th, s.cDesc]}>Description</Text>
            <Text style={[s.th, s.cAmt]}>Amount</Text>
          </View>
          {dpNum > 0 && (
            <View style={s.tr}>
              <Text style={[s.td, s.cNum, { color: "#166534", fontFamily: "Helvetica-Bold" }]}>#0</Text>
              <Text style={[s.td, s.cDate, { color: "#166534", fontFamily: "Helvetica-Bold" }]}>{data.startDate}</Text>
              <Text style={[s.td, s.cDesc, { color: "#166534", fontFamily: "Helvetica-Bold" }]}>Advance Down Payment (Paid at Signing)</Text>
              <Text style={[s.td, s.cAmt, { color: "#166534", fontFamily: "Helvetica-Bold" }]}>{data.downPayment}</Text>
            </View>
          )}
          {data.schedule.map((row, i) => (
            <View key={row.number} style={i === data.schedule.length - 1 ? s.trLast : s.tr}>
              <Text style={[s.td, s.cNum]}>{String(row.number)}</Text>
              <Text style={[s.td, s.cDate]}>{row.dueDate}</Text>
              <Text style={[s.td, s.cDesc]}>{row.description}</Text>
              <Text style={[s.td, s.cAmt]}>{row.amount}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={[s.td, s.cNum]}> </Text>
            <Text style={[s.td, s.cDate]}> </Text>
            <Text style={[s.td, s.cDesc, { fontFamily: "Helvetica-Bold" }]}>Total</Text>
            <Text style={[s.td, s.cAmt, { fontFamily: "Helvetica-Bold" }]}>{data.financedAmount}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Terms of Sale</Text>
        {terms.map((t, i) => (
          <View key={i} style={s.term}>
            <Text style={s.termNum}>{i + 1}.</Text>
            <Text style={s.termText}>{t}</Text>
          </View>
        ))}

        {data.notes ? (
          <>
            <Text style={s.sectionTitle}>Additional Notes</Text>
            <Text>{data.notes}</Text>
          </>
        ) : null}

        <View style={s.signatures}>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Seller Signature</Text>
              <Text style={{ color: "#666666", marginTop: 2 }}>{data.seller.name}</Text>
              <Text style={{ color: "#666666" }}>Date: ______________</Text>
            </View>
          </View>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Buyer Signature</Text>
              <Text style={{ color: "#666666", marginTop: 2 }}>{data.buyer.name}</Text>
              <Text style={{ color: "#666666" }}>Date: ______________</Text>
            </View>
          </View>
        </View>

        <Text style={s.footer} fixed>
          {data.contractNumber} · Generated {data.agreementDate}
        </Text>
      </Page>
    </Document>
  );
}

function buildTerms(d: AgreementData): string[] {
  const asset = d.kind === "car" ? "vehicle" : d.kind === "gold" ? "gold item(s)" : "product";
  return [
    `The Seller agrees to sell and the Buyer agrees to purchase the ${asset} described above for the total agreed amount of ${d.totalAmount}.`,
    `The Buyer shall pay the financed amount of ${d.financedAmount} in accordance with the payment schedule set out in this agreement.`,
    `Payments may be made by cash, bank transfer, or online payment. The Buyer must retain proof of every payment made.`,
    `The agreed duration of this contract is ${d.durationLabel}, commencing ${d.startDate} and scheduled for completion on ${d.endDate}.`,
    `Reasonable flexibility is permitted in the exact calendar date on which each installment is paid. A payment made shortly after its scheduled date does not, by itself, constitute a breach of this agreement or attract any penalty.`,
    d.penalty,
    `Partial payments are accepted and will be credited against the relevant installment. Any shortfall remains outstanding until settled in full.`,
    `Ownership of the ${asset} transfers to the Buyer upon full and final settlement of all amounts due under this agreement.`,
    `The Buyer is responsible for the care and safekeeping of the ${asset} from the date of delivery.`,
    `This agreement constitutes the entire understanding between the parties and supersedes any prior arrangement, whether written or verbal.`,
    `Both parties confirm that they have read, understood, and accepted all terms set out above.`,
  ];
}
