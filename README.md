# **AI ATL 2025**

Introducing _Sprout_, your AI idea mentor that boosts your brainstorming with YOUR ideas!

Please visit our [Devpost](https://devpost.com/software/sprout-u91sxf) for more information.

Hosted at [hardlythinking.tech](https://www.hardlythinking.tech/).

# Sprout
## Inspiration
Brainstorming is hard for everyone. We've been there - school essays, projects, ideas - and we know there has to be a better way. Have you ever gotten stuck writing halfway through a sentence? Have you ever felt your ideas overflow so much that you needed more space to write them down on the side? We've all seen people use ChatGPT and Claude - "Give me 10 unique hackathon ideas" - but we're not here to sacrifice our humanity and critical thinking to a meager artificial intelligence: at least not all of it. Welcome to Sprout, your centralized hub for all things idea-based.

## What it does
Instead of giving you the finished product, Sprout aims to be a mentor, offering more avenues for your idea to grow.

### The four building blocks
- **Trunk**: the centerpiece. This uneditable starting block is directly obtained from the context you provide when you first create the project.
- **Branches**: the concrete ideas. You can add these to the canvas yourself, and they represent solid thoughts that you want to build off of.
- **Leaves**: the explorative directions. Create these on your own or allow the embedded artificial intelligence to suggest them for you.
- **Notes**: the comments. Add these around the canvas to quickly mark down your thought process.

### Workflow
- Create a new project. Enter your mission statement, root question, or whatever thoughts you have so far; Sprout will read this and push your creativity to the next level. 
- Our personalized agent gives you live questions and comments in the form of leaves that force you to consider new perspectives and flesh your idea out _yourself_. Instantly after making a new project, three thought-provoking questions and comments appear to guide you.
- Click on the leaves to follow them and get more feedback.
- Drag and drop your elements accordingly to organize your thoughts.

Through a mix of branches, leaves, and notes, Sprout provides you with the tools to cultivate your idea into a flourishing, holistic world of possibilities.

### More Features
- Check out the sidebar to generate potentially helpful links for your topic. Take input from other people.
- Press the "Refresh Ideas" button in the top left to replace old ideas with new ones. 
- Like an idea to save it to your list! Press the 'x' button to delete it.

Need to finish that one body paragraph? Want to write a haiku about the summertime? Thinking of new food recipes to try? Wonder what your next hit song should be about? Put your ideas and creations into the canvas and let Sprout boost your brainstorming.

## How we built it
- **Frontend** - Our user interface was built with Next.js, Typescript, TailwindCSS, and ShadCN for their rich animations and components, maximizing the user experience.
- **Backend** - The Firestore database stores our user and project information. We use Firebase authentication for a simple, secure sign-in.
- **Hosting** - We use Vercel for the development process and for hosting the production environment, connected with the GitHub Repo for streamlined deployment.
- **Artificial Intelligence** - Our choice of model is Gemini Flash 2.0 for its instantaneous and thoughtful responses. This is vital for our fast-paced brainstorming style.

## Challenges and Accomplishments
- Neither of us had worked with websites with artificial intelligence as the central component before, so every venture was a shot in the dark. 
- We are very proud of the way the canvas turned out. We hadn't worked with expansive whiteboard interfaces before, especially with drag-and-drop elements, and the UI became much better than we expected coming in.

## What we learned
We made sure to spend a lot of time developing a reasonable and achievable idea this time, which proved to be invaluable for organization and having time to make final edits.

## What's next for Sprout
Throughout the development process, we had some considerations for an extension of the product:
- Integrate a voice-to-text or conversational feature, where the user can talk through their ideas rather than type them down. The website can then write down the user's thoughts and provide feedback more quickly.
- Expand to shareable online projects so groups can think and collaborate.
- Allow image embedding and AI suggestions related to the content.

## Comprehensive Codebase Analysis

### Core Architecture
Sprout is built on a modern **Next.js 16** (App Router) framework, leveraging **React 19** for its latest concurrent features. The application follows a clear separation of concerns:
- **Frontend**: `src/app` handles routing and layout, while `src/components` contains reusable UI elements built with **ShadCN UI** (Radix primitives + Lucide icons) and styled with **TailwindCSS 4**.
- **Backend Services**: Serverless architecture using **Firebase 12**. `src/services/firebase.ts` and `firestore.ts` manage authentication and database interactions.
- **AI Integration**: Server-side API routes (`src/app/api`) interface with **Google's Gemini 2.0 Flash** model.

### Key Technical Implementations

#### 1. Infinite Canvas System (`src/components/canvas`)
The heart of Sprout is a custom-built infinite canvas engine.
- **Performance**: Uses `useRef` for direct DOM manipulation and coordinate tracking to ensure 60fps performance during drag-and-drop operations, bypassing React's render cycle for high-frequency events.
- **Coordinate System**: Implements a virtual world coordinate system (`x`, `y`) with smooth panning and zooming capabilities.
- **Data Model**: Defined in `src/lib/canvasModel.ts`, the canvas treats ideas as a tree structure of `blocks` (Branches and Leaves) with parent-child relationships, allowing for complex idea mapping.

#### 2. AI "Mentor" Logic (`src/app/api/ideas/generate`)
The AI is not just a text generator but a structured "Facilitator".
- **Dual Modes**: The system dynamically switches between a **Generator** persona (for creative expansion) and a **Provocateur** persona (for challenging assumptions) based on user intent.
- **Structured Output**: Enforces strict JSON responses from the Gemini model to ensure seamless integration with the frontend UI components.
- **Context Awareness**: The API route constructs prompts that include the project's "Trunk" (mission statement) and the specific context of the selected branch/leaf to generate relevant suggestions.

#### 3. Data Persistence & State
- **Firestore**: Utilized for real-time data storage of Projects, Ideas, and Notes. The data structure supports the hierarchical nature of the mind map.
- **Authentication**: Firebase Auth handles user sessions with persistence enabled, ensuring a smooth user experience across reloads.

