export type User = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  verified?: boolean;
  isOnline?: boolean;
};

export type PostReaction = {
  likes: number;
  comments: number;
  reposts: number;
  hasLiked?: boolean;
  hasReposted?: boolean;
};

export type Post = {
  id: string;
  author: User;
  content: string;
  images?: string[];
  createdAt: string;
  reactions: PostReaction;
  replies?: Post[];
  replyToId?: string;
  quotedPost?: Post;
  poll?: {
    id: string;
    options: string[];
    votes: { userId: string, optionIndex: number }[];
  };
};

export const currentUser: User = {
  id: "u1",
  name: "Current User",
  handle: "currentuser",
  avatar: "https://i.pravatar.cc/150?u=current",
};

export const mockPosts: Post[] = [
  {
    id: "p1",
    author: {
      id: "u2",
      name: "Michael Dell",
      handle: "MichaelDell",
      avatar: "https://i.pravatar.cc/150?u=dell",
      verified: true,
    },
    content: "Why demand is growing so fast:\n\nMore compute + more data -> better AI.\n\nBetter AI -> more usage.\n\nMore usage -> more data and compute demand.\n\nRepeat.\n\nAI is the first technology that creates demand for itself. #AI #Tech",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    reactions: {
      likes: 892,
      comments: 124,
      reposts: 145,
    },
    replies: [
      {
        id: "p1_r1",
        author: {
          id: "u3",
          name: "Amanda L",
          handle: "AmandaL395460",
          avatar: "https://i.pravatar.cc/150?u=amanda",
          verified: true,
        },
        content: "lol. no its the first one to grind out on its own tail. @MichaelDell",
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
        reactions: {
          likes: 189,
          comments: 0,
          reposts: 0,
        },
        replyToId: "p1",
      }
    ]
  },
  {
    id: "p2",
    author: {
      id: "u4",
      name: "Elon Musk",
      handle: "elonmusk",
      avatar: "https://i.pravatar.cc/150?u=elon",
      verified: true,
    },
    content: "Make our Sun sentient to understand the Universe and extend the light of consciousness to the stars",
    images: ["https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?q=80&w=1000&auto=format&fit=crop"],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    reactions: {
      likes: 45000,
      comments: 3200,
      reposts: 12000,
    }
  },
  {
    id: "p3",
    author: {
      id: "u5",
      name: "Chess Master",
      handle: "chessmaster",
      avatar: "https://i.pravatar.cc/150?u=chess",
    },
    content: "Just played the most insane match. The Sicilian Defense never fails to deliver! Check out this sequence.",
    images: [
      "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1580541832626-2a7131ee809f?q=80&w=1000&auto=format&fit=crop"
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    reactions: {
      likes: 42,
      comments: 5,
      reposts: 2,
    }
  }
];

export const mockUsers: User[] = [
  currentUser,
  mockPosts[0].author,
  mockPosts[0].replies![0].author,
  mockPosts[1].author,
  mockPosts[2].author,
];
