import { redirect } from "next/navigation";

export const metadata = { title: "Runshift — Dashboard" };

export default function DashboardAliasPage() {
  redirect("/");
}
