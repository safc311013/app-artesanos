require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");

async function main() {
  const nombre = "Administrador";
  const email = "admin@hilos.com";
  const password = "Admin12345";

  const existing = await prisma.usuario.findUnique({
    where: { email },
  });

  if (existing) {
    console.log("El usuario admin ya existe.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.usuario.create({
    data: {
      nombre,
      email,
      passwordHash,
      activo: true,
    },
  });

  console.log("Usuario admin creado correctamente.");
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