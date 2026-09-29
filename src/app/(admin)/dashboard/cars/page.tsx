import ProductTypePage from "../products/[kind]/page";

export const metadata = { title: "Cars — InstallPro" };

export default function CarsPage() {
  return <ProductTypePage params={Promise.resolve({ kind: "car" })} />;
}
