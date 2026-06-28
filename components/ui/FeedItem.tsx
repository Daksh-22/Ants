"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Share2 } from "lucide-react";
import { Card } from "./Card";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";
import type { FeedPost } from "@/lib/data/mock";
import { cn } from "@/lib/utils/cn";

/** A single tribe-activity post — the main content unit of the home feed. */
export function FeedItem({ post }: { post: FeedPost }) {
  const [liked, setLiked] = useState(false);
  const fireCount = post.fire + (liked ? 1 : 0);

  return (
    <Card pressable className="border-l-2 border-gold">
      {/* author row */}
      <div className="flex items-center gap-3">
        <Avatar initials={post.initials} color="purple" size={28} />
        <p className="text-[13px]">
          <span className="font-bold text-gold">{post.handle}</span>
          <span className="text-muted">{"  ·  "}{post.time}</span>
        </p>
      </div>

      {/* body */}
      <p className="mt-3 text-body text-primary">{post.body}</p>

      {/* pill tags */}
      <div className="mt-3 flex flex-wrap gap-2">
        {post.tags.map((tag) => (
          <Badge key={tag.label} tone={tag.tone === "gain" ? "gain" : "neutral"}>
            {tag.label}
          </Badge>
        ))}
      </div>

      {/* reactions */}
      <div className="mt-4 flex items-center gap-5 text-[13px] font-semibold text-secondary">
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={() => setLiked((v) => !v)}
          className={cn("flex items-center gap-1.5 transition-colors", liked && "text-gold")}
        >
          <span className="text-[15px]">🔥</span>
          <span className="tabular">{fireCount}</span>
        </motion.button>
        <button type="button" className="flex items-center gap-1.5">
          <MessageCircle size={15} strokeWidth={2.4} />
          <span className="tabular">{post.comments}</span>
        </button>
        <button type="button" className="ml-auto flex items-center gap-1.5">
          <Share2 size={15} strokeWidth={2.4} />
          <span>Share</span>
        </button>
      </div>
    </Card>
  );
}
