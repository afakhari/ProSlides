import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";

export default function App() {
  const [selected, setSelected] = useState("Home");

  const menuItems = ["Home", "Profile", "Settings"];

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md flex flex-col p-4">
        <h1 className="text-xl font-bold mb-6">Menu</h1>
        <ul className="flex-1 space-y-2">
          {menuItems.map((item) => (
            <li
              key={item}
              onClick={() => setSelected(item)}
              className={`cursor-pointer p-2 rounded-md ${
                selected === item
                  ? "bg-blue-500 text-white"
                  : "hover:bg-gray-100"
              }`}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{selected}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              You are viewing the <strong>{selected}</strong> page.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
