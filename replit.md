# TypeRace Pro - Real-time Typing Race Application

## Overview

TypeRace Pro is a real-time multiplayer typing race application built with React and Node.js. Users can join typing races, compete against other players in real-time, and track their typing speed (WPM), accuracy, and performance rankings. The application features a modern UI built with shadcn/ui components and real-time communication via Socket.IO.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Real-time Communication**: Socket.IO client for WebSocket connections

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Real-time Communication**: Socket.IO server for WebSocket handling
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Type Safety**: Shared TypeScript schemas between client and server

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon Database
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Temporary Storage**: In-memory storage implementation for development/testing

## Key Components

### Database Schema
- **Users**: User authentication and profiles
- **Races**: Race configurations (text passages, difficulty, time limits)
- **Race Participants**: Player progress tracking within races
- **Text Passages**: Predefined typing content for races

### Real-time Features
- **WebSocket Connection Management**: Socket.IO handles player connections
- **Race State Synchronization**: Real-time updates of player progress
- **Race Lifecycle Management**: Automatic race start/end handling
- **Progress Tracking**: Live WPM, accuracy, and error tracking

### UI Components
- **Race Selector**: Browse and join available races
- **Race Interface**: Live typing interface with progress visualization
- **Race Results**: Post-race statistics and rankings
- **Connection Status**: Real-time connection monitoring

## Data Flow

1. **Race Creation**: Players create races with custom settings (difficulty, time limit, max players)
2. **Race Joining**: Players join waiting races via WebSocket connection
3. **Race Start**: Automatic race initiation when minimum players are present
4. **Progress Tracking**: Real-time typing progress sent via WebSocket messages
5. **Race Completion**: Final results calculated and displayed with rankings

### WebSocket Message Types
- `joinRace`: Player joins a race
- `leaveRace`: Player leaves a race
- `raceUpdate`: Live race state updates
- `raceStarted`: Race initiation notification
- `raceFinished`: Race completion with results
- `progressUpdate`: Player typing progress updates

## External Dependencies

### Frontend Dependencies
- **React Ecosystem**: React, React DOM, React Hook Form
- **UI Framework**: Radix UI primitives, Lucide React icons
- **State Management**: TanStack React Query
- **Utilities**: class-variance-authority, clsx, date-fns
- **Real-time**: Socket.IO client

### Backend Dependencies
- **Server Framework**: Express.js
- **Database**: Drizzle ORM, @neondatabase/serverless
- **Real-time**: Socket.IO server
- **Development**: tsx for TypeScript execution

### Build Tools
- **Bundling**: Vite for frontend, esbuild for backend
- **TypeScript**: Full type safety across the stack
- **Development**: Hot reload and error overlay support

## Deployment Strategy

### Environment Configuration
- **Development**: Local development with Vite dev server
- **Production**: Built static files served by Express
- **Database**: Environment-based DATABASE_URL configuration

### Build Process
1. **Frontend Build**: Vite builds React app to static files
2. **Backend Build**: esbuild bundles Node.js server
3. **Asset Serving**: Express serves built frontend files

### Replit Integration
- **Auto-deployment**: Configured for Replit's autoscale deployment
- **Port Configuration**: Server runs on port 5000 (mapped to port 80)
- **Development Workflow**: Integrated with Replit's development environment

## Changelog

```
Changelog:
- June 20, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```