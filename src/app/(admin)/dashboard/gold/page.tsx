import ProductTypePage from "../products/[kind]/page";

export const metadata = { title: "Gold — InstallPro" };

export default function GoldPage() {
  return <ProductTypePage params={Promise.resolve({ kind: "gold" })} />;
}
