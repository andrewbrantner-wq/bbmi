"use client";

import Image from "next/image";

export default function BBMILogo() {
  return (
    <Image
      src="/logo-bbmi-navy-v4.png"
      alt="BBMI Logo"
      width={160}   // increase width
      height={40}  // increase height
      priority
    />
  );
}