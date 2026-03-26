// ---------------------------------------------------------------------------
// Preview Content (rendered as formatted legal document)
// ---------------------------------------------------------------------------

import { type DocumentState, subLabel } from "./types";

export function PreviewContent({ doc }: { doc: DocumentState }) {
  const h = doc.header;
  const hasHeader = h.mahkeme || h.davaci || h.davali || h.konu;

  let numberedIdx = 0;

  return (
    <div className="space-y-0">
      {/* Court header */}
      {h.mahkeme && (
        <div className="text-center mb-8">
          <p className="font-bold text-[18px] uppercase tracking-wide">
            {h.mahkeme.toLocaleUpperCase("tr")}&apos;NE
          </p>
        </div>
      )}

      {/* Parties */}
      {hasHeader && (
        <div className="mb-6 space-y-1 text-[15px]">
          {(h.davaci || h.davaci_tc || h.davaci_adres || h.davaci_vekili) && (
            <div className="space-y-0.5">
              <div className="flex">
                <span className="w-28 font-bold shrink-0">DAVACI</span>
                <span>: {h.davaci}</span>
              </div>
              {h.davaci_tc && (
                <div className="flex">
                  <span className="w-28 shrink-0 text-[#555]">TC Kimlik No</span>
                  <span>: {h.davaci_tc}</span>
                </div>
              )}
              {h.davaci_adres && (
                <div className="flex">
                  <span className="w-28 shrink-0 text-[#555]">Adres</span>
                  <span>: {h.davaci_adres}</span>
                </div>
              )}
              {h.davaci_vekili && (
                <div className="flex">
                  <span className="w-28 shrink-0 text-[#555]">Vekili</span>
                  <span>: {h.davaci_vekili}</span>
                </div>
              )}
            </div>
          )}

          {(h.davali || h.davali_adres) && (
            <div className="space-y-0.5 mt-3">
              <div className="flex">
                <span className="w-28 font-bold shrink-0">DAVALI</span>
                <span>: {h.davali}</span>
              </div>
              {h.davali_adres && (
                <div className="flex">
                  <span className="w-28 shrink-0 text-[#555]">Adres</span>
                  <span>: {h.davali_adres}</span>
                </div>
              )}
            </div>
          )}

          {h.konu && (
            <div className="flex mt-3">
              <span className="w-28 font-bold shrink-0">KONU</span>
              <span>: {h.konu}</span>
            </div>
          )}
        </div>
      )}

      {hasHeader && <hr className="border-[#CCC] my-6" />}

      {/* Blocks */}
      {doc.blocks.map((block) => {
        switch (block.type) {
          case "section_header":
            return (
              <div key={block.id} className="mt-6 mb-3">
                <h3 className="font-bold text-[17px] uppercase tracking-wide border-b border-[#CCC] pb-1">
                  {block.content || "(Bölüm başlığı)"}
                </h3>
              </div>
            );

          case "numbered_paragraph": {
            numberedIdx++;
            return (
              <div key={block.id} className="mb-3">
                <p className="text-justify">
                  <span className="font-bold mr-1">{numberedIdx}.</span>
                  {block.content || "(...)"}
                </p>
                {block.children && block.children.length > 0 && (
                  <div className="ml-6 mt-1 space-y-0.5">
                    {block.children.map((sub, si) => {
                      const letter = subLabel(si);
                      return (
                        <p key={sub.id} className="text-justify">
                          <span className="font-medium mr-1">
                            {letter})
                          </span>
                          {sub.content || "(...)"}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          case "free_text":
            return (
              <p key={block.id} className="mb-3 text-justify">
                {block.content || "(...)"}
              </p>
            );

          case "evidence_item":
            return (
              <div key={block.id} className="flex gap-2 mb-1 ml-4">
                <span className="text-[#555]">&ndash;</span>
                <span>{block.content || "(Delil)"}</span>
              </div>
            );

          case "legal_reference":
            return (
              <div
                key={block.id}
                className="mb-2 ml-4 pl-3 border-l-2 border-purple-400/40 italic text-[15px] text-[#444] font-mono"
              >
                {block.content || "(Kanun referansı)"}
              </div>
            );

          default:
            return (
              <p key={block.id} className="mb-2">
                {block.content}
              </p>
            );
        }
      })}

      {/* Signature area */}
      {hasHeader && (
        <div className="mt-12 text-right">
          <p className="italic">Saygılarımla,</p>
          {h.davaci_vekili && (
            <p className="font-bold mt-1">{h.davaci_vekili}</p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!hasHeader && doc.blocks.length === 0 && (
        <div className="text-center py-16 text-[#999] text-[15px]">
          <p>Sol panelden belgenizi oluşturmaya başlayın.</p>
          <p className="mt-1 text-[14px]">
            Başlık bilgilerini doldurun ve bloklar ekleyin.
          </p>
        </div>
      )}
    </div>
  );
}
