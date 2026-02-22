import slugify from "slugify";
import { prisma } from "../src/libs/prisma";

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { name: "monita" },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // 🇮🇩 Base Indonesian product catalog
  const baseProducts = [
    "Beras Ramos 5kg",
    "Beras Pandan Wangi 5kg",
    "Minyak Goreng Bimoli 2L",
    "Minyak Goreng Sunco 2L",
    "Gula Pasir Gulaku 1kg",
    "Gula Merah Aren 500gr",
    "Indomie Goreng",
    "Indomie Soto",
    "Mie Sedaap Goreng",
    "Teh Botol Sosro 450ml",
    "Teh Pucuk Harum 350ml",
    "Kopi Kapal Api Sachet",
    "Kopi ABC Susu",
    "Kopi Luwak White Coffee",
    "Susu Ultra Milk Coklat 1L",
    "Susu Dancow Fortigro",
    "Sabun Lifebuoy Merah",
    "Sabun Lux Soft Touch",
    "Shampoo Pantene 170ml",
    "Shampoo Clear Anti Ketombe",
    "Pasta Gigi Pepsodent",
    "Detergen Rinso 1kg",
    "Detergen So Klin 1kg",
    "Pewangi Pakaian Molto",
    "Saus Sambal ABC",
    "Saus Tomat ABC",
    "Kecap Manis Bango",
    "Kecap Manis ABC",
    "Tepung Terigu Segitiga Biru 1kg",
    "Tepung Beras Rose Brand",
    "Minyak Kayu Putih Cap Lang",
    "Obat Nyamuk Baygon",
    "Obat Nyamuk Vape",
    "Tissue Paseo",
    "Tissue Nice",
    "Air Mineral Aqua 600ml",
    "Air Mineral Le Minerale 600ml",
    "Snack Chitato Sapi Panggang",
    "Snack Qtela Original",
    "Biskuit Roma Kelapa",
    "Biskuit Marie Regal",
    "Sarden ABC Kaleng",
    "Sarden Maya Kaleng",
    "Susu Kental Manis Indomilk",
    "Susu Kental Manis Frisian Flag",
    "Margarin Blue Band",
    "Margarin Filma",
    "Telur Ayam Negeri 1kg",
    "Daging Ayam Broiler 1kg",
    "Frozen Nugget Fiesta",
    "Frozen Sosis So Nice",
    "Bawang Merah 1kg",
    "Bawang Putih 1kg",
    "Cabai Merah Keriting 1kg",
    "Cabai Rawit Merah 500gr",
    "Garam Dolphin",
    "Garam Cap Kapal",
    "Kerupuk Udang",
    "Kerupuk Ikan",
    "Roti Tawar Sari Roti",
    "Roti Sobek Sari Roti",
    "Selai Kacang Skippy",
    "Selai Coklat Nutella",
    "Madu TJ 250ml",
    "Madu Nusantara",
    "Kornet Sapi Pronas",
    "Kornet Sapi ABC",
  ];

  // 🔢 Ensure exactly 75 items
  const products75 = baseProducts.slice(0, 75);

  const inventoryData = products75.map((name, index) => {
    const basePrice = 3000 + index * 500;

    return {
      tenantId: tenant.id,
      name,
      slug: slugify(name, {
        lower: true,
        strict: true,
        locale: "id",
      }),
      code: `PRD-${String(index + 1).padStart(4, "0")}`,
      description: `Produk ${name} kualitas terbaik`,
      price: basePrice + 2000,
      cost: basePrice,
      stock: 50 + (index % 10) * 10,
      sold: Math.floor(Math.random() * 30),
      isActive: true,
    };
  });

  await prisma.inventory.createMany({
    data: inventoryData,
    skipDuplicates: true,
  });

  console.log("✅ 75 Indonesian inventory products seeded");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
