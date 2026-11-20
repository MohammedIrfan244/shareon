import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Database, Cloud } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy - ShareOn',
  description: 'Privacy Policy and data protection overview for ShareOn',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col p-4 sm:p-6 md:p-10">
      <div className="max-w-2xl w-full mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Storage</span>
          </Link>

          <div className="flex items-center gap-2 pt-2">
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
            <h1 className="text-xl font-bold text-white tracking-tight">Privacy Policy</h1>
          </div>
          <p className="text-xs text-zinc-400">
            Last updated: November 2026 • ShareOn Shared Storage
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-6 text-xs sm:text-sm text-zinc-300 leading-relaxed border-t border-zinc-800/80 pt-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-zinc-400" />
              <span>1. Overview &amp; Purpose</span>
            </h2>
            <p className="text-zinc-400">
              ShareOn is a private, shared storage platform designed for designated users. We do
              not sell, monetize, or track your data. The platform exists solely to allow authorized
              users to store, organize, and download files.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-zinc-400" />
              <span>2. How Your Files Are Stored</span>
            </h2>
            <p className="text-zinc-400">
              Depending on the type of file uploaded, storage is split as follows:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-zinc-400 pl-1">
              <li>
                <strong className="text-zinc-200">Text Documents &amp; Code:</strong> Stored
                directly inside MongoDB as UTF-8 text for instant retrieval.
              </li>
              <li>
                <strong className="text-zinc-200">Media &amp; Binaries:</strong> Uploaded to secure
                cloud storage via Google Drive API over encrypted TLS connections.
              </li>
              <li>
                <strong className="text-zinc-200">Metadata:</strong> Titles, original filenames,
                file sizes, and timestamps are cataloged in MongoDB.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-zinc-400" />
              <span>3. Password-Protected Files</span>
            </h2>
            <p className="text-zinc-400">
              When a file is uploaded with password protection:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-zinc-400 pl-1">
              <li>
                The password is cryptographically hashed using <strong className="text-zinc-200">bcrypt</strong> with a high work factor before storage. Raw passwords are never saved.
              </li>
              <li>
                The download URL and raw content are stripped at the database level and never transmitted to the browser until the correct password has been verified by the server.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cloud className="w-4 h-4 text-zinc-400" />
              <span>4. Authentication &amp; Sessions</span>
            </h2>
            <p className="text-zinc-400">
              User authentication is handled via secure, signed JWT tokens stored in <code className="text-zinc-200 bg-zinc-900 px-1 py-0.5 rounded text-xs">HTTP-only</code> cookies with <code className="text-zinc-200 bg-zinc-900 px-1 py-0.5 rounded text-xs">SameSite=Lax</code> protection. These cookies prevent client-side JavaScript access and defend against cross-site request forgery.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-white">5. Deletion &amp; Data Retention</h2>
            <p className="text-zinc-400">
              When a user deletes a file or folder, all associated records in MongoDB and binary assets stored on Google Drive are permanently purged immediately. We do not retain shadow copies or soft-deleted items.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-white">6. Third-Party Trackers &amp; Analytics</h2>
            <p className="text-zinc-400">
              ShareOn uses zero external tracking pixels, third-party analytics, or advertising SDKs. Your activity remains completely private between you and your shared users.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-zinc-800 text-center text-xs text-zinc-500">
          <p>© 2026 ShareOn. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
