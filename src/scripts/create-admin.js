require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");

async function main() {
  const nombre = "Administrador";
  const email = "admin@hilos.com";
  const password = "Admin12345";

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.usuario.upsert({
    where: { email },
    update: {
      nombre,
      passwordHash,
      activo: true,
    },
    create: {
      nombre,
      email,
      passwordHash,
      activo: true,
    },
  });

  console.log("Usuario admin restablecido correctamente.");
  console.log("Email:", email);
  console.log("Password:", password);
}

main()
  .catch((error) => {
    console.error("Error creando usuario admin:", error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
