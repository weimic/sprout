"use client";

import { useParams } from "next/navigation";

export default function ProjectPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? "";

  return (
    <div style={{ padding: 16 }}>
      <h1>Project: {projectId}</h1>
      {/* Fetch and render project/ideas client-side after auth using services/firestore.ts */}
    </div>
  );
}
