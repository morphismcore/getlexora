export default function Loading() {
  return (
    <div className="h-full flex items-center justify-center bg-[#09090B]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#6C6CFF] border-t-transparent rounded-full animate-spin" />
        <span className="text-[14px] text-[#5C5C5F]">Yükleniyor...</span>
      </div>
    </div>
  );
}
