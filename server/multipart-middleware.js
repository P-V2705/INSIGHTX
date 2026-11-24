// server/multipart-middleware.js
// Multipart form-data parser for file uploads using busboy

import Busboy from "busboy";

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB safety limit

/**
 * Parse multipart/form-data for file uploads
 * Expects single file field named "file"
 * Sets req.file with { buffer, originalname, mimetype }
 */
export function parseMultipart() {
  return (req, res, next) => {
    const contentType = req.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return next();
    }

    let fileReceived = false;
    let error = null;
    let fileSize = 0;

    const bb = Busboy({ headers: req.headers });

    bb.on("file", (fieldname, file, fileinfo) => {
      // Only accept "file" field, ignore others
      if (fieldname !== "file" || fileReceived) {
        file.resume();
        return;
      }

      fileReceived = true;
      const chunks = [];

      file.on("data", (data) => {
        fileSize += data.length;
        if (fileSize > MAX_FILE_SIZE) {
          error = new Error("File exceeds maximum size limit");
          file.destroy();
          return;
        }
        chunks.push(data);
      });

      file.on("end", () => {
        if (!error) {
          req.file = {
            buffer: Buffer.concat(chunks),
            originalname: fileinfo.filename,
            mimetype: fileinfo.mimeType || "application/octet-stream",
            size: fileSize,
          };
        }
      });

      file.on("error", (err) => {
        error = err;
        file.resume();
      });
    });

    bb.on("error", (err) => {
      error = err;
    });

    bb.on("finish", () => {
      if (error) {
        return next(error);
      }
      next();
    });

    // Pipe request into busboy
    req.pipe(bb);
  };
}
