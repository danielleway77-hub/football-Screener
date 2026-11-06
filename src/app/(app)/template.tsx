import { PageTransition } from "@/components/motion/PageTransition";

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
