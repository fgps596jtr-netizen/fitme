import fs from "fs";
import os from "os";
import path from "path";
import { Client } from "magic-hour";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    const { person, garment, garmentType = "upper_body" } = req.body;

    if (!person || !garment) {
      return res.status(400).json({
        error: "Il faut envoyer une photo de toi et une photo du vêtement."
      });
    }

    if (!process.env.MAGIC_HOUR_API_KEY) {
      return res.status(500).json({
        error: "La clé Magic Hour n'est pas configurée sur Vercel."
      });
    }

    const tempDir = os.tmpdir();

    const personPath = path.join(tempDir, "person.jpg");
    const garmentPath = path.join(tempDir, "garment.jpg");

    fs.writeFileSync(
      personPath,
      Buffer.from(person.replace(/^data:image\/\w+;base64,/, ""), "base64")
    );

    fs.writeFileSync(
      garmentPath,
      Buffer.from(garment.replace(/^data:image\/\w+;base64,/, ""), "base64")
    );

    const client = new Client({
      token: process.env.MAGIC_HOUR_API_KEY
    });

    const result = await client.v1.aiClothesChanger.generate(
      {
        name: "FitMe - Essayage virtuel",
        assets: {
          personFilePath: personPath,
          garmentFilePath: garmentPath,
          garmentType: garmentType
        }
      },
      {
        waitForCompletion: true,
        downloadOutputs: true,
        downloadDirectory: tempDir
      }
    );

    if (!result.downloadedPaths || result.downloadedPaths.length === 0) {
      return res.status(500).json({
        error: "Magic Hour n'a pas retourné d'image."
      });
    }

    const outputPath = result.downloadedPaths[0];
    const imageBuffer = fs.readFileSync(outputPath);

    return res.status(200).json({
      image: `data:image/png;base64,${imageBuffer.toString("base64")}`
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error?.message || "Erreur lors de la génération."
    });
  }
}
