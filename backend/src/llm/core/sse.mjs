export const parseSseBlock = (block) => {
  const lines = block.split("\n");
  let event = "message";
  const dataLines = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }

  return { event, data: dataLines.join("\n") };
};

