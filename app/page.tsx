import { redirect } from "next/navigation";

// Root redirects to login; middleware handles authenticated users → /dashboard
export default function RootPage() {
  redirect("/login");
}
