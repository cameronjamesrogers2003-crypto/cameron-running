export default function NovicePlanLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes novicePop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}`,
        }}
      />
      <div className="min-h-[calc(100vh-4rem)] bg-[#f5f2eb] text-[#1e293b]">{children}</div>
    </>
  );
}
