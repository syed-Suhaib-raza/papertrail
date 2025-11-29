// app/(public)/layout.tsx
import Link from "next/link";
import Image from 'next/image';
import logo from "@/public/logo.png";
export const metadata = {
  title: "Journal Archive",
  description: "Browse published papers and issues",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
        {/* NAVBAR */}
        <header className="border-b bg-white">
          <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
            <div className="flex items-center">
  <Link href="/" className="flex items-center space-x-2">
    <Image
      src={logo}
      alt="Papertrail Logo"
      width={40}
      height={40}
    />
    <span className="text-xl font-semibold">papertrail.</span>
  </Link>
</div>


            <div className="flex items-center space-x-6 text-sm">
              <Link href="/" className="hover:text-blue-600">
                Home
              </Link>
              <Link href="/archive" className="hover:text-blue-600">
                Archive
              </Link>
              <Link href="/issues" className="hover:text-blue-600">
                Issues
              </Link>
              <Link href="/about" className="hover:text-blue-600">
                About
              </Link>

              <Link
                href="/login"
                className="px-3 py-1 border rounded hover:bg-gray-100 transition"
              >
                Login
              </Link>
            </div>
          </nav>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
          {children}
        </main>

        {/* FOOTER */}
        <footer className="border-t bg-white mt-10">
          <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-gray-600 flex justify-between">
            <span>© {new Date().getFullYear()} Journal</span>
            <span>
              <Link href="/privacy" className="hover:underline">
                Privacy Policy
              </Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}