# 学習分析システム「ISM・SP表対応MVP」

## Project Overview
- **Name**: 学習分析システム「ISM・SP表対応MVP」
- **Goal**: 小学校における生成AI活用の学習過程を記録・分析し、児童の深い学びを可視化するシステムのMVP版。
- **Features**:
  - 学年・学級・名簿管理（匿名化）
  - 単元管理・ISM（map(T)）の作成と編集
  - 授業セッション管理と児童のログイン・ログ記録
  - 児童UI（下書き、AI対話、最終提出）
  - 単元末分析（伝達係数tの計算、SP表の出力）

## URLs
- **Production**: https://elementary-analysis.pages.dev
- **GitHub**: https://github.com/taka400h110-stack/Elementary-school-Analysys-with-AI

## Data Architecture
- **Tech Stack**: Cloudflare Pages / Workers, Hono, Vite, React (Frontend to be developed), Tailwind CSS
- **Data Models**: 
  - `classes`, `students`, `enrollments`: 学校・学級・児童の管理
  - `units`, `nodes`, `edges_T`, `rubrics`: 単元・ISM構造・評価基準
  - `sessions`, `drafts`, `chat_turns`, `submissions`: 授業と学習ログ
  - `edges_S`, `metrics`: 生徒の理解構造(map(S))と分析結果
- **Storage Services**: Cloudflare D1 

## User Guide
現在、バックエンドとデータベースの初期設計、および簡単なステータス画面が実装されています。
トップ画面にアクセスするとAPIの疎通確認（D1データベース連携含む）が行えます。

## Deployment
- **Platform**: Cloudflare Pages
- **Status**: ✅ Active 
- **Last Updated**: 2026-03-15
