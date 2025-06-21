"use client";

import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { SendHorizonal, UploadCloud } from "lucide-react";

type Message = {
  id: number;
  text: string;
  sender: "user" | "bot";
};

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pdfText, setPdfText] = useState(""); // 📄 Store parsed PDF text
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Load pdf.js from CDN
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
      }
    };
    document.body.appendChild(script);
  }, []);

  // 🧠 Gemini API call with chat history + optional PDF context
  const callGeminiAPI = async (userInput: string) => {
    const API_KEY = "AIzaSyDrdjkugeLk6m-88ES9ykBKW6jbdRoDUDQ";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    const formattedMessages = [
      ...(pdfText ? [{ role: "user", parts: [{ text: `Context from uploaded PDF:\n${pdfText}` }] }] : []),
      ...messages.map((msg) => ({
        role: msg.sender === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      })),
      {
        role: "user",
        parts: [{ text: userInput }],
      },
    ];

    const payload = {
      contents: formattedMessages,
      generationConfig: {
        responseMimeType: "text/plain",
      },
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      const aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sorry, I couldn't understand that.";

      const botMessage: Message = {
        id: Date.now() + 1,
        text: aiReply,
        sender: "bot",
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          text: "Error fetching response from Gemini API.",
          sender: "bot",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // 📄 Parse uploaded PDF
  const parsePDF = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => item.str).join(" ");
      fullText += `Page ${i}:\n${text}\n\n`;
    }

    console.log("📄 Parsed PDF Content:\n", fullText);
    setPdfText(fullText); // Save for context
  };

  // 📨 Send button
  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      sender: "user",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    callGeminiAPI(input);
  };

  // ↵ Enter = Send
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSend();
  };

  // 📂 File upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      const fileMessage: Message = {
        id: Date.now(),
        text: `✅ 1 file uploaded: ${file.name}`,
        sender: "user",
      };

      setMessages((prev) => [...prev, fileMessage]);
      parsePDF(file).catch((err) => console.error("❌ Failed to parse PDF:", err));
    } else {
      alert("Please upload a valid PDF file.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-100 to-blue-200 p-4">
      <h1 className="text-4xl font-bold text-purple-800 mb-6">🤖Quirra</h1>

      <Card className="w-full max-w-2xl h-[80vh] flex flex-col">
        {/* 💬 Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`px-4 py-2 rounded-2xl max-w-[70%] text-sm shadow-md whitespace-pre-wrap break-words ${
                  msg.sender === "user" ? "bg-purple-600 text-white" : "bg-white text-gray-800"
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="px-4 py-2 rounded-2xl bg-white text-gray-800 text-sm shadow-md animate-pulse">
                Typing...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 🧾 Input + Upload + Send */}
        <div className="p-4 border-t border-gray-300 flex gap-2 items-center">
          <Input
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-grow"
          />

          <label htmlFor="upload" className="cursor-pointer">
            <UploadCloud className="h-5 w-5 text-purple-600 hover:text-purple-800" />
            <input
              id="upload"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          <Button
            onClick={handleSend}
            size="icon"
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            <SendHorizonal className="h-5 w-5" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
