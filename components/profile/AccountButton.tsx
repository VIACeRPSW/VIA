"use client";

import dynamic from "next/dynamic";

const ClientUserButton = dynamic(
  () => import("@clerk/nextjs").then(({ UserButton }) => UserButton),
  { ssr: false },
);

export function AccountButton() {
  return <ClientUserButton />;
}
