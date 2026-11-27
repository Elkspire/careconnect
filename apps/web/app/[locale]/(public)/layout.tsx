import { SiteHeader } from "@/components/site-header";

/** Public-site pages keep the site header; workspaces use AppShell instead. */
export default function PublicLayout(props: LayoutProps<"/[locale]">) {
  return (
    <>
      <SiteHeader />
      {props.children}
    </>
  );
}
