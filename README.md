# Datacom Kudos System

This project implements a **Kudos** feature for Datacom’s internal employee portal.  
It allows users to give public recognition to colleagues through short appreciation messages.

## Features
- Send kudos to a colleague with a short message (max 280 chars)
- Public feed of recent kudos
- Input validation (no self-kudos, message length, sanitization)
- Administrator moderation — hide, unhide, or delete inappropriate messages
- Simple in-memory backend (future-ready for database integration)

## Tech Stack
- Node.js + Express (API)
- React / Vite (Frontend)
- JSON storage (temporary in-memory persistence)

## Specification
Development followed a **spec-driven workflow**:
- Functional & Technical Requirements defined in `SPECIFICATION.md`
- Approved specification triggered AI-assisted implementation in Cursor
- Includes moderation fields: `is_visible`, `moderated_by`, `moderated_at`, `reason_for_moderation`

## Getting Started
```bash
npm install
npm run dev
