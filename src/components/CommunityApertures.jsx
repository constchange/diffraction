import { useEffect, useRef, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react/ArrowClockwise";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { CloudArrowUp } from "@phosphor-icons/react/CloudArrowUp";
import { FolderOpen } from "@phosphor-icons/react/FolderOpen";
import { GlobeHemisphereWest } from "@phosphor-icons/react/GlobeHemisphereWest";
import { Trash } from "@phosphor-icons/react/Trash";
import { X } from "@phosphor-icons/react/X";
import {
  decodeScreenDefinition,
  encodeAperture,
  encodeScreenDefinition,
} from "../core/apertureStorage.js";
import {
  deleteCommunityAperture,
  getCommunityAperture,
  listCommunityApertures,
  listOwnedCommunityApertures,
  uploadCommunityAperture,
} from "../core/communityApi.js";

const PAGE_SIZE = 18;
const SLOT_NUMBERS = [1, 2, 3];

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function CommunityPreview({ preview, label }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !preview) return;
    const context = canvas.getContext("2d", { alpha: false });
    try {
      const binary = atob(preview);
      if (binary.length !== 48 * 48) throw new Error("invalid preview");
      const image = context.createImageData(48, 48);
      for (let index = 0; index < binary.length; index += 1) {
        const value = binary.charCodeAt(index);
        const offset = index * 4;
        image.data[offset] = value;
        image.data[offset + 1] = value;
        image.data[offset + 2] = value;
        image.data[offset + 3] = 255;
      }
      context.putImageData(image, 0, 0);
    } catch {
      context.fillStyle = "#030711";
      context.fillRect(0, 0, 48, 48);
    }
  }, [preview]);

  return <canvas ref={canvasRef} className="community-preview" width="48" height="48" aria-label={`${label}的衍射屏预览`} />;
}

function EmptyState({ children }) {
  return (
    <div className="community-empty">
      <GlobeHemisphereWest size={28} weight="duotone" />
      <p>{children}</p>
    </div>
  );
}

export function CommunityApertures({
  open,
  aperture,
  mode,
  formula,
  size,
  apiBase,
  onLoad,
  onClose,
}) {
  const [tab, setTab] = useState("browse");
  const [publicItems, setPublicItems] = useState([]);
  const [ownedItems, setOwnedItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState(1);
  const [nickname, setNickname] = useState("");
  const [patternName, setPatternName] = useState("");
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [action, setAction] = useState("");
  const [notice, setNotice] = useState({ type: "info", message: "" });

  const selectedRecord = ownedItems.find((item) => item.slot === selectedSlot);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function refreshPublic(targetPage = page, signal) {
    setLoadingPublic(true);
    try {
      const result = await listCommunityApertures(apiBase, targetPage, PAGE_SIZE, signal);
      setPublicItems(result.items);
      setTotal(result.total);
      setPage(result.page);
    } catch (error) {
      if (error.name !== "AbortError") setNotice({ type: "error", message: error.message });
    } finally {
      setLoadingPublic(false);
    }
  }

  async function refreshMine(signal) {
    setLoadingMine(true);
    try {
      const result = await listOwnedCommunityApertures(apiBase, signal);
      setOwnedItems(result.items);
    } catch (error) {
      if (error.name !== "AbortError") setNotice({ type: "error", message: error.message });
    } finally {
      setLoadingMine(false);
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setNotice({ type: "info", message: "" });
    Promise.all([
      refreshPublic(1, controller.signal),
      refreshMine(controller.signal),
    ]);
    return () => controller.abort();
  }, [open, apiBase]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape" && !action) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, action, onClose]);

  function chooseSlot(slot) {
    setSelectedSlot(slot);
    const record = ownedItems.find((item) => item.slot === slot);
    if (record) {
      setNickname(record.nickname);
      setPatternName(record.patternName);
    } else {
      setPatternName("");
    }
    setNotice({ type: "info", message: "" });
  }

  async function handleUpload() {
    if (!nickname.trim() || !patternName.trim()) {
      setNotice({ type: "error", message: "请填写昵称和衍射屏名称" });
      return;
    }
    setAction("upload");
    setNotice({ type: "info", message: "正在上传…" });
    try {
      const result = await uploadCommunityAperture(apiBase, {
        slot: selectedSlot,
        nickname,
        patternName,
        aperture: encodeScreenDefinition({ mode, aperture, formula }, size),
        ...(mode === "function" ? { previewAperture: encodeAperture(aperture, size) } : {}),
      });
      setNotice({
        type: "success",
        message: result.overwritten ? `第 ${selectedSlot} 档已覆盖` : `已上传到第 ${selectedSlot} 档`,
      });
      await Promise.all([refreshMine(), refreshPublic(1)]);
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setAction("");
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`确定删除第 ${item.slot} 档“${item.patternName}”吗？删除后无法恢复。`)) return;
    setAction(`delete-${item.id}`);
    try {
      await deleteCommunityAperture(apiBase, item.id);
      setNotice({ type: "success", message: `第 ${item.slot} 档已删除` });
      await Promise.all([refreshMine(), refreshPublic(page)]);
      if (selectedSlot === item.slot) setPatternName("");
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setAction("");
    }
  }

  async function handleLoad(item) {
    setAction(`load-${item.id}`);
    try {
      const result = await getCommunityAperture(apiBase, item.id);
      const savedScreen = decodeScreenDefinition(result.item.aperture, size);
      onLoad(savedScreen, result.item);
      onClose();
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setAction("");
    }
  }

  if (!open) return null;

  return (
    <div className="community-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !action) onClose();
    }}>
      <section className="community-dialog" role="dialog" aria-modal="true" aria-labelledby="community-title">
        <header className="community-header">
          <div className="community-heading-mark"><GlobeHemisphereWest size={24} weight="duotone" /></div>
          <div>
            <h2 id="community-title">公共衍射屏</h2>
            <p>分享实验灵感，也可以载入其他同学的屏函数</p>
          </div>
          <button type="button" className="community-close" onClick={onClose} disabled={Boolean(action)} aria-label="关闭公共空间"><X size={18} /></button>
        </header>

        <div className="community-tabs" role="tablist" aria-label="公共空间页面">
          <button type="button" role="tab" aria-selected={tab === "browse"} className={tab === "browse" ? "active" : ""} onClick={() => setTab("browse")}>
            <GlobeHemisphereWest size={16} /> 浏览全部 <span>{total}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}>
            <CloudArrowUp size={16} /> 我的三个档位 <span>{ownedItems.length}/3</span>
          </button>
        </div>

        {notice.message && <div className={`community-notice ${notice.type}`} role="status">{notice.type === "success" && <CheckCircle size={15} weight="fill" />}{notice.message}</div>}

        {tab === "browse" ? (
          <div className="community-browse-panel">
            <div className="community-section-heading">
              <div><strong>按名称排序</strong><span>第 {page}/{pageCount} 页</span></div>
              <button type="button" onClick={() => refreshPublic(page)} disabled={loadingPublic}><ArrowClockwise size={15} className={loadingPublic ? "spinning" : ""} /> 刷新</button>
            </div>
            {publicItems.length === 0 && !loadingPublic ? (
              <EmptyState>公共空间还是空的，去“我的三个档位”上传第一个作品吧。</EmptyState>
            ) : (
              <div className={`community-gallery ${loadingPublic ? "loading" : ""}`}>
                {publicItems.map((item) => (
                  <article className="community-card" key={item.id}>
                    <CommunityPreview preview={item.preview} label={item.patternName} />
                    <div className="community-card-copy">
                      <h3 title={item.patternName}>{item.patternName}</h3>
                      <p>来自 <strong>{item.nickname}</strong></p>
                      <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
                    </div>
                    <button type="button" onClick={() => handleLoad(item)} disabled={Boolean(action)}><FolderOpen size={15} /> {action === `load-${item.id}` ? "载入中" : "载入"}</button>
                  </article>
                ))}
              </div>
            )}
            <div className="community-pagination">
              <button type="button" disabled={page <= 1 || loadingPublic} onClick={() => refreshPublic(page - 1)}>上一页</button>
              <span>{total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} / ${total}` : "0 个作品"}</span>
              <button type="button" disabled={page >= pageCount || loadingPublic} onClick={() => refreshPublic(page + 1)}>下一页</button>
            </div>
          </div>
        ) : (
          <div className="community-upload-panel">
            <div className="community-slot-list" aria-label="当前 IP 的三个公共档位">
              {SLOT_NUMBERS.map((slot) => {
                const record = ownedItems.find((item) => item.slot === slot);
                return (
                  <button type="button" key={slot} className={selectedSlot === slot ? "active" : ""} onClick={() => chooseSlot(slot)}>
                    <span>0{slot}</span>
                    <div><strong>{record?.patternName ?? "空档位"}</strong><small>{record ? `已由 ${record.nickname} 上传` : "可上传当前衍射屏"}</small></div>
                  </button>
                );
              })}
            </div>

            <div className="community-upload-form">
              <div className="community-form-title">
                <div><strong>上传当前衍射屏</strong><span>第 {selectedSlot} 档</span></div>
                {selectedRecord && <em>再次上传将覆盖这个档位</em>}
              </div>
              <label><span>你的昵称</span><input value={nickname} maxLength="20" placeholder="例如：小光" onChange={(event) => setNickname(event.target.value)} /></label>
              <label><span>衍射屏名称</span><input value={patternName} maxLength="32" placeholder="例如：六边形阵列" onChange={(event) => setPatternName(event.target.value)} /></label>
              <button type="button" className="community-upload-action" onClick={handleUpload} disabled={Boolean(action) || loadingMine}>
                <CloudArrowUp size={17} /> {action === "upload" ? "上传中…" : selectedRecord ? `覆盖第 ${selectedSlot} 档` : `上传到第 ${selectedSlot} 档`}
              </button>
            </div>

            <div className="community-owned-list">
              <div className="community-section-heading"><div><strong>已上传作品</strong><span>同一网络地址最多 3 个</span></div></div>
              {ownedItems.length === 0 && !loadingMine ? <EmptyState>你还没有上传公共衍射屏。</EmptyState> : ownedItems.map((item) => (
                <article key={item.id}>
                  <CommunityPreview preview={item.preview} label={item.patternName} />
                  <div><strong>{item.patternName}</strong><span>第 {item.slot} 档 · {formatDate(item.updatedAt)}</span></div>
                  <button type="button" onClick={() => handleDelete(item)} disabled={Boolean(action)}><Trash size={15} /> {action === `delete-${item.id}` ? "删除中" : "删除"}</button>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
