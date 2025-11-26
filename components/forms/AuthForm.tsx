// components/AuthForm.tsx
"use client";
import React from "react";

type Props = {
  children?: React.ReactNode;
  title?: string;
};

export default function AuthForm({ children, title }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <h1 className="text-2xl font-semibold mb-4">{title}</h1>
        {children}
      </div>
    </div>
  );
}