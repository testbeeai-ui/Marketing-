I will significantly deepen the prompt generation logic to create richer, more profound visual concepts.

### **Plan**
1.  **Enhance `imageGenerator.ts`**:
    *   **Deepen the System Prompt**: I will rewrite the "Art Director" persona to focus on *conceptual depth* and *narrative layering*. Instead of just "visual style," it will ask for "visual storytelling."
    *   **Add "Visual Dimensions"**: I will instruct the AI to explicitly consider:
        *   **Foreground vs. Background**: Creating depth of field to show scale (e.g., a small gamer in front of a massive digital universe).
        *   **Lighting as Emotion**: Using lighting not just for visibility, but to convey the *feeling* of the text (e.g., "the glow of a screen in a dark room" vs "stadium lights").
        *   **Texture & Materiality**: specifying materials that reflect the concept (e.g., "glitch art textures" for digital topics).
    *   **Refine Output Structure**: I will update the output format to require a "Concept Rationale" (internal chain-of-thought) before the final prompt to ensure the AI thinks deeply before outputting the final string.

2.  **Goal**: The result will be image prompts that aren't just "pretty pictures" but *visual interpretations* of your text's deeper meaning.