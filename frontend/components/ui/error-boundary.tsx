"use client";
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="w-14 h-14 bg-[#E5484D]/10 rounded-2xl flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth={1.5}><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
          </div>
          <h2 className="text-[16px] font-semibold text-[#ECECEE] mb-1">Bir hata oluştu</h2>
          <p className="text-[15px] text-[#5C5C5F] mb-4 max-w-sm">Sayfa yüklenirken beklenmeyen bir hata meydana geldi.</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} className="px-4 py-2 text-[15px] font-medium text-white bg-[#6C6CFF] hover:bg-[#7B7BFF] rounded-xl transition-colors">
            Tekrar Dene
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
