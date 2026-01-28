"use client";

import Image from "next/image";

export default function BBMILogo() {
  return (
    <Image
      src="/logo-bbmi-navy-v5.svg"
      alt="BBMI Logo"
      width={160}   // increase width
      height={160}  // increase height
      priority
    />
  );
}