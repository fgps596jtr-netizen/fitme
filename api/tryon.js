import fs from "fs";
import os from "os";
import path from "path";
import { Client } from "magic-hour";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée"
    });
  }

  try {
    const {
      person,
      upper,
      lower
    } = req.body;

    if (!person || (!upper && !lower)) {
      return res.status(400).json({
        error: "Il faut envoyer une photo de toi et au moins un vêtement."
      });
    }

    if (!process.env.MAGIC_HOUR_API_KEY) {
      return res.status(500).json({
        error: "La clé Magic Hour n'est pas configurée sur Vercel."
      });
    }

    const tempDir = os.tmpdir();

    const client = new Client({
      token: process.env.MAGIC_HOUR_API_KEY
    });

    function saveImage(data, filename) {
      const filePath = path.join(tempDir, filename);

      const base64 = data.replace(
        /^data:image\/\w+;base64,/,
        ""
      );

      fs.writeFileSync(
        filePath,
        Buffer.from(base64, "base64")
      );

      return filePath;
    }

    // Photo originale de la personne
    let currentPersonPath = saveImage(
      person,
      "fitme-person.jpg"
    );

    // Fonction qui applique un vêtement
    async function applyGarment(
      garmentData,
      garmentType,
      label
    ) {
      const garmentPath = saveImage(
        garmentData,
        `fitme-${label}.jpg`
      );

      const result =
        await client.v1.aiClothesChanger.generate(
          {
            name: `FitMe - ${label}`,

            assets: {
              personFilePath:
                currentPersonPath,

              garmentFilePath:
                garmentPath,

              garmentType:
                garmentType
            }
          },
          {
            waitForCompletion: true,

            downloadOutputs: true,

            downloadDirectory:
              tempDir
          }
        );

      if (
        !result.downloadedPaths ||
        result.downloadedPaths.length === 0
      ) {
        throw new Error(
          `Magic Hour n'a pas retourné d'image pour le ${label}.`
        );
      }

      // Le résultat devient la nouvelle photo
      // sur laquelle on applique éventuellement
      // le vêtement suivant.
      currentPersonPath =
        result.downloadedPaths[0];
    }

    // Appliquer le haut
    if (upper) {
      await applyGarment(
        upper,
        "upper_body",
        "haut"
      );
    }

    // Puis appliquer le bas
    if (lower) {
      await applyGarment(
        lower,
        "lower_body",
        "bas"
      );
    }

    // Lire l'image finale
    const imageBuffer =
      fs.readFileSync(
        currentPersonPath
      );

    return res.status(200).json({
      ok: true,

      imageUrl:
        `data:image/png;base64,${imageBuffer.toString("base64")}`
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error:
        error?.message ||
        "Erreur lors de la génération."
    });
  }
}
