// const express = require("express");
// const multer = require("multer");
// const cors = require("cors");
// const { exec } = require("child_process"); // To execute Pandoc
// const fs = require("fs"); // Node.js built-in file system module
// const fsExtra = require("fs-extra"); // For easier file operations like ensureDir, remove, rename
// const path = require("path"); // Node.js built-in path module
// const cheerio = require("cheerio"); // For HTML parsing and manipulation

// const app = express();
// const uploadDir = path.join(__dirname, "uploads"); // Directory for uploaded files

// // --- IMPORTANT: Verify this path matches your Pandoc installation ---
// // Example: If Pandoc is at 'C:\Program Files\Pandoc\pandoc.exe', use that.
// const PANDOC_EXECUTABLE_PATH = 'C:\\pandoc\\pandoc.exe';

// // Ensure the 'uploads' directory exists. If not, fsExtra will create it.
// fsExtra.ensureDirSync(uploadDir);

// // Configure multer to save uploaded files to the 'uploads' directory.
// // Changed from .single("file") to .array("files") to accept multiple files.
// // The 'files' string matches the field name on the client-side FormData.
// const upload = multer({ dest: uploadDir });

// // Enable CORS for your React app.
// app.use(cors());
// // Enable parsing of JSON request bodies.
// app.use(express.json());

// // --- Helper function to process a single uploaded file ---
// // This function encapsulates the logic for renaming, Pandoc conversion,
// // HTML cleaning, and file cleanup for one .docx file.
// async function processSingleFile(file) {
//     const uploadedTempPath = file.path; // Multer's temporary path for this file
//     const inputDocxPath = `${uploadedTempPath}.docx`; // Path after renaming to .docx
//     const outputHtmlPath = `${uploadedTempPath}.html`; // Path for Pandoc's HTML output

//     try {
//         // Step 1: Rename the uploaded file to add the .docx extension.
//         await fsExtra.rename(uploadedTempPath, inputDocxPath);
//         console.log(`Renamed "${file.originalname}" from "${uploadedTempPath}" to "${inputDocxPath}"`);

//         // Step 2: Construct and execute the Pandoc command.
//         const pandocCommand = `"${PANDOC_EXECUTABLE_PATH}" "${inputDocxPath}" -s --mathml --self-contained -o "${outputHtmlPath}"`;
//         console.log(`Executing Pandoc command for "${file.originalname}": ${pandocCommand}`);

//         // Wrap exec in a Promise to use with async/await for cleaner flow
//         await new Promise((resolve, reject) => {
//             exec(pandocCommand, async (error, stdout, stderr) => {
//                 // --- Cleanup input DOCX file ---
//                 try {
//                     await fsExtra.remove(inputDocxPath);
//                     console.log(`Cleaned up input .docx file for "${file.originalname}"`);
//                 } catch (cleanupError) {
//                     if (cleanupError.code !== 'ENOENT') { // ENOENT means file doesn't exist, which is fine
//                         console.error(`Error cleaning up input file "${inputDocxPath}" for "${file.originalname}": ${cleanupError.message}`);
//                     }
//                 }

//                 if (error) {
//                     console.error(`Pandoc conversion failed for "${file.originalname}": ${error.message}`);
//                     console.error(`Pandoc stderr for "${file.originalname}": ${stderr}`);
//                     // --- Cleanup output HTML file on error ---
//                     try {
//                         await fsExtra.remove(outputHtmlPath);
//                         console.log(`Cleaned up failed output .html file for "${file.originalname}"`);
//                     } catch (cleanupError) {
//                         if (cleanupError.code !== 'ENOENT') {
//                             console.error(`Error cleaning up output file "${outputHtmlPath}" after Pandoc failure for "${file.originalname}": ${cleanupError.message}`);
//                         }
//                     }
//                     return reject(new Error(`Pandoc conversion failed for "${file.originalname}": ${stderr || error.message}`));
//                 }

//                 console.log(`Pandoc conversion successful for "${file.originalname}". Pandoc stdout: ${stdout}`);
//                 resolve(); // Resolve the promise if Pandoc command succeeds
//             });
//         });

//         // Step 3: Read the generated HTML content from the output file.
//         if (!fs.existsSync(outputHtmlPath)) {
//             throw new Error(`Pandoc finished, but output HTML file not found for "${file.originalname}" at: "${outputHtmlPath}"`);
//         }
//         let htmlContent = await fsExtra.readFile(outputHtmlPath, 'utf8');
//         console.log(`Successfully read HTML content from "${outputHtmlPath}" for "${file.originalname}". Content length: ${htmlContent.length} bytes`);

//         // Step 4: Process HTML with Cheerio to remove unwanted body styles.
//         const $ = cheerio.load(htmlContent);
//         $('head style').each((index, element) => {
//             let styleContent = $(element).html();
//             const propertiesToRemove = [
//                 'margin:[^;]*;?',
//                 'max-width:[^;]*;?',
//                 'padding-left:[^;]*;?',
//                 'padding-right:[^;]*;?',
//                 'padding-top:[^;]*;?',
//                 'padding-bottom:[^;]*;?',
//                 'border-top:[^;]*;?',
//                 'border-bottom:[^;]*;?',
//             ];
//             styleContent = styleContent.replace(
//                 /(body\s*\{[^}]*)/s,
//                 (match, bodyRuleBlock) => {
//                     let modifiedBodyRuleBlock = bodyRuleBlock;
//                     propertiesToRemove.forEach(propRegexStr => {
//                         const regex = new RegExp(`\\s*${propRegexStr}`, 'g');
//                         modifiedBodyRuleBlock = modifiedBodyRuleBlock.replace(regex, '');
//                     });
//                     return modifiedBodyRuleBlock;
//                 }
//             );
//             $(element).html(styleContent);
//         });
//         const cleanedHtmlContent = $.html();

//         // Step 5: Clean up the generated HTML file.
//         await fsExtra.remove(outputHtmlPath);
//         console.log(`Cleaned up output .html file for "${file.originalname}"`);

//         // Return an object with the filename and its cleaned HTML content.
//         return { filename: file.originalname, content: cleanedHtmlContent, status: 'success' };

//     } catch (err) {
//         // This catch block handles errors during renaming, Pandoc execution (via Promise rejection),
//         // HTML reading, or HTML processing.
//         console.error(`Error processing file "${file.originalname}": ${err.message}`);
//         // Ensure original uploaded temp file (from multer) is cleaned up if an early error occurs.
//         try {
//             await fsExtra.remove(uploadedTempPath);
//             console.log(`Cleaned up original uploaded temp file for "${file.originalname}" on error.`);
//         } catch (cleanupErr) {
//             if (cleanupErr.code !== 'ENOENT') {
//                 console.error(`Error cleaning up original uploaded file "${uploadedTempPath}" on top-level error for "${file.originalname}": ${cleanupErr.message}`);
//             }
//         }
//         // Return a 'failed' status for this specific file, including its error.
//         return { filename: file.originalname, error: err.message, status: 'failed' };
//     }
// }

// // ---

// // ### ** POST`/upload` Endpoint(Modified for Multiple Files)**

// // ```javascript
// app.post("/upload", upload.array("files"), async (req, res) => {
//     // Check if any files were actually uploaded.
//     if (!req.files || req.files.length === 0) {
//         return res.status(400).json({ error: "No files uploaded." });
//     }

//     console.log(`Received ${req.files.length} files for upload.`);

//     // Process all files concurrently using Promise.all
//     // Each call to processSingleFile returns a Promise that resolves with a result object
//     const processingPromises = req.files.map(file => processSingleFile(file));

//     try {
//         const results = await Promise.all(processingPromises);

//         // Separate successful conversions from failed ones
//         const successfulContents = results.filter(r => r.status === 'success');
//         const failedContents = results.filter(r => r.status === 'failed');

//         if (successfulContents.length > 0) {
//             // Send successful conversions as an array of objects
//             res.json({
//                 contents: successfulContents,
//                 // Optionally include details about failed conversions if any
//                 failed: failedContents.length > 0 ? failedContents : undefined
//             });
//         } else {
//             // If all files failed, return a 500 status with error details
//             res.status(500).json({
//                 error: "All files failed to convert.",
//                 failed: failedContents
//             });
//         }

//     } catch (overallError) {
//         // This catch block would primarily handle unexpected errors from Promise.all itself
//         // (e.g., if one of the file processing promises rejected before all were settled).
//         console.error("Overall error during multiple file processing:", overallError);
//         res.status(500).json({
//             error: "An unexpected error occurred during file processing.",
//             details: overallError.message
//         });
//     }
// });

// const PORT = 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT} `));

// Version 2
// const express = require("express");
// const multer = require("multer");
// const cors = require("cors");
// const { exec } = require("child_process");
// const fs = require("fs");
// const fsExtra = require("fs-extra");
// const path = require("path");
// const cheerio = require("cheerio");

// const app = express();
// const uploadDir = path.join(__dirname, "uploads");

// const PANDOC_EXECUTABLE_PATH = 'C:\\pandoc\\pandoc.exe'; // IMPORTANT: Verify this path

// fsExtra.ensureDirSync(uploadDir);

// const upload = multer({ dest: uploadDir });

// app.use(cors());
// app.use(express.json());

// async function processSingleFile(file) {
//     const uploadedTempPath = file.path;
//     const inputDocxPath = `${uploadedTempPath}.docx`;
//     const outputHtmlPath = `${uploadedTempPath}.html`;

//     try {
//         await fsExtra.rename(uploadedTempPath, inputDocxPath);
//         console.log(`Renamed "${file.originalname}" from "${uploadedTempPath}" to "${inputDocxPath}"`);

//         const pandocCommand = `"${PANDOC_EXECUTABLE_PATH}" "${inputDocxPath}" -s --mathml --self-contained -o "${outputHtmlPath}"`;
//         console.log(`Executing Pandoc command for "${file.originalname}": ${pandocCommand}`);

//         await new Promise((resolve, reject) => {
//             exec(pandocCommand, async (error, stdout, stderr) => {
//                 try {
//                     await fsExtra.remove(inputDocxPath);
//                     console.log(`Cleaned up input .docx file for "${file.originalname}"`);
//                 } catch (cleanupError) {
//                     if (cleanupError.code !== 'ENOENT') {
//                         console.error(`Error cleaning up input file "${inputDocxPath}" for "${file.originalname}": ${cleanupError.message}`);
//                     }
//                 }

//                 if (error) {
//                     console.error(`Pandoc conversion failed for "${file.originalname}": ${error.message}`);
//                     console.error(`Pandoc stderr for "${file.originalname}": ${stderr}`);
//                     try {
//                         await fsExtra.remove(outputHtmlPath);
//                         console.log(`Cleaned up failed output .html file for "${file.originalname}"`);
//                     } catch (cleanupError) {
//                         if (cleanupError.code !== 'ENOENT') {
//                             console.error(`Error cleaning up output file "${outputHtmlPath}" after Pandoc failure for "${file.originalname}": ${cleanupError.message}`);
//                         }
//                     }
//                     return reject(new Error(`Pandoc conversion failed for "${file.originalname}": ${stderr || error.message}`));
//                 }

//                 console.log(`Pandoc conversion successful for "${file.originalname}". Pandoc stdout: ${stdout}`);
//                 resolve();
//             });
//         });

//         if (!fs.existsSync(outputHtmlPath)) {
//             throw new Error(`Pandoc finished, but output HTML file not found for "${file.originalname}" at: "${outputHtmlPath}"`);
//         }
//         let htmlContent = await fsExtra.readFile(outputHtmlPath, 'utf8');
//         console.log(`Successfully read HTML content from "${outputHtmlPath}" for "${file.originalname}". Content length: ${htmlContent.length} bytes`);

//         // Step 4: Process HTML with Cheerio to remove unwanted body styles and borders.
//         const $ = cheerio.load(htmlContent);

//         // --- 1. Remove specific body styles from inline <style> tags ---
//         $('head style').each((index, element) => {
//             let styleContent = $(element).html();
//             const propertiesToRemove = [
//                 'margin:[^;]*;?',
//                 'max-width:[^;]*;?',
//                 'padding-left:[^;]*;?',
//                 'padding-right:[^;]*;?',
//                 'padding-top:[^;]*;?',
//                 'padding-bottom:[^;]*;?',
//                 'border-top:[^;]*;?',
//                 'border-bottom:[^;]*;?',
//                 // Add any other body-specific styles you find problematic here
//             ];
//             styleContent = styleContent.replace(
//                 /(body\s*\{[^}]*)/s,
//                 (match, bodyRuleBlock) => {
//                     let modifiedBodyRuleBlock = bodyRuleBlock;
//                     propertiesToRemove.forEach(propRegexStr => {
//                         const regex = new RegExp(`\\s*${propRegexStr}`, 'g');
//                         modifiedBodyRuleBlock = modifiedBodyRuleBlock.replace(regex, '');
//                     });
//                     return modifiedBodyRuleBlock;
//                 }
//             );
//             $(element).html(styleContent);
//         });

//         // --- 2. Remove borders from tables, tbody, and their cells ---

//         // Option A: Remove inline style borders (if Pandoc adds them directly)
//         // **MODIFIED LINE HERE: Added 'tbody' to the selector**
//         $('table, tbody, th, td').each((index, element) => {
//             const $el = $(element);
//             const style = $el.attr('style');
//             if (style) {
//                 // Regex to remove any border-related properties
//                 const newStyle = style.replace(/(border(?:(?:-(?:top|bottom|left|right))?|-(?:style|width|color))?:\s*[^;]+;?\s*)|(outline:\s*[^;]+;?\s*)/gi, '');
//                 $el.attr('style', newStyle);
//             }
//             // Also remove border attributes directly on table elements (deprecated but sometimes generated)
//             // No specific border attributes for tbody, but keeping for table, th, td.
//             if (element.tagName.toLowerCase() === 'table') {
//                 $el.removeAttr('border');
//                 $el.removeAttr('cellspacing');
//                 $el.removeAttr('cellpadding');
//             }
//         });

//         // Option B: Modify existing CSS rules within <style> tags for table-related elements
//         $('head style').each((index, element) => {
//             let styleContent = $(element).html();

//             // Target table, tbody, th, td selectors
//             // **MODIFIED LINE HERE: Added 'tbody' to the regex pattern**
//             const tableBorderRegex = /(table\s*\{[^}]*)|(tbody\s*\{[^}]*)|(th\s*\{[^}]*)|(td\s*\{[^}]*)/gs; // `s` flag for dotall
//             styleContent = styleContent.replace(tableBorderRegex, (match, tableRule, tbodyRule, thRule, tdRule) => {
//                 let modifiedRule = match;
//                 const borderPropertiesToRemove = [
//                     'border-collapse:[^;]*;?',
//                     'border(?:(?:-(?:top|bottom|left|right))?|-(?:style|width|color))?:\s*[^;]+;?\s*',
//                     'outline:\s*[^;]+;?\s*'
//                 ];
//                 borderPropertiesToRemove.forEach(propRegexStr => {
//                     const regex = new RegExp(propRegexStr, 'gi');
//                     modifiedRule = modifiedRule.replace(regex, '');
//                 });
//                 return modifiedRule;
//             });
//             $(element).html(styleContent);
//         });

//         const cleanedHtmlContent = $.html();

//         await fsExtra.remove(outputHtmlPath);
//         console.log(`Cleaned up output .html file for "${file.originalname}"`);

//         return { filename: file.originalname, content: cleanedHtmlContent, status: 'success' };

//     } catch (err) {
//         console.error(`Error processing file "${file.originalname}": ${err.message}`);
//         try {
//             await fsExtra.remove(uploadedTempPath);
//             console.log(`Cleaned up original uploaded temp file for "${file.originalname}" on error.`);
//         } catch (cleanupErr) {
//             if (cleanupErr.code !== 'ENOENT') {
//                 console.error(`Error cleaning up original uploaded file "${uploadedTempPath}" on top-level error for "${file.originalname}": ${cleanupErr.message}`);
//             }
//         }
//         return { filename: file.originalname, error: err.message, status: 'failed' };
//     }
// }

// // ... (rest of your app.post("/upload") and server listening code remains the same)

// app.post("/upload", upload.array("files"), async (req, res) => {
//     if (!req.files || req.files.length === 0) {
//         return res.status(400).json({ error: "No files uploaded." });
//     }

//     console.log(`Received ${req.files.length} files for upload.`);

//     const processingPromises = req.files.map(file => processSingleFile(file));

//     try {
//         const results = await Promise.all(processingPromises);

//         const successfulContents = results.filter(r => r.status === 'success');
//         const failedContents = results.filter(r => r.status === 'failed');

//         if (successfulContents.length > 0) {
//             res.json({
//                 contents: successfulContents,
//                 failed: failedContents.length > 0 ? failedContents : undefined
//             });
//         } else {
//             res.status(500).json({
//                 error: "All files failed to convert.",
//                 failed: failedContents
//             });
//         }

//     } catch (overallError) {
//         console.error("Overall error during multiple file processing:", overallError);
//         res.status(500).json({
//             error: "An unexpected error occurred during file processing.",
//             details: overallError.message
//         });
//     }
// });

// const PORT = 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT} `));

// Version 3
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const fsExtra = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");

const app = express();
const uploadDir = path.join(__dirname, "uploads");

const PANDOC_EXECUTABLE_PATH = 'C:\\pandoc\\pandoc.exe'; // IMPORTANT: Verify this path

fsExtra.ensureDirSync(uploadDir);

const upload = multer({ dest: uploadDir });

app.use(cors());
app.use(express.json());

async function processSingleFile(file) {
    const uploadedTempPath = file.path;
    const inputDocxPath = `${uploadedTempPath}.docx`;
    const outputHtmlPath = `${uploadedTempPath}.html`;

    try {
        await fsExtra.rename(uploadedTempPath, inputDocxPath);
        console.log(`Renamed "${file.originalname}" from "${uploadedTempPath}" to "${inputDocxPath}"`);

        const pandocCommand = `"${PANDOC_EXECUTABLE_PATH}" "${inputDocxPath}" -s --mathml --self-contained -o "${outputHtmlPath}"`;
        console.log(`Executing Pandoc command for "${file.originalname}": ${pandocCommand}`);

        await new Promise((resolve, reject) => {
            exec(pandocCommand, async (error, stdout, stderr) => {
                try {
                    await fsExtra.remove(inputDocxPath);
                    console.log(`Cleaned up input .docx file for "${file.originalname}"`);
                } catch (cleanupError) {
                    if (cleanupError.code !== 'ENOENT') {
                        console.error(`Error cleaning up input file "${inputDocxPath}" for "${file.originalname}": ${cleanupError.message}`);
                    }
                }

                if (error) {
                    console.error(`Pandoc conversion failed for "${file.originalname}": ${error.message}`);
                    console.error(`Pandoc stderr for "${file.originalname}": ${stderr}`);
                    try {
                        await fsExtra.remove(outputHtmlPath);
                        console.log(`Cleaned up failed output .html file for "${file.originalname}"`);
                    } catch (cleanupError) {
                        if (cleanupError.code !== 'ENOENT') {
                            console.error(`Error cleaning up output file "${outputHtmlPath}" after Pandoc failure for "${file.originalname}": ${cleanupError.message}`);
                        }
                    }
                    return reject(new Error(`Pandoc conversion failed for "${file.originalname}": ${stderr || error.message}`));
                }

                console.log(`Pandoc conversion successful for "${file.originalname}". Pandoc stdout: ${stdout}`);
                resolve();
            });
        });

        if (!fs.existsSync(outputHtmlPath)) {
            throw new Error(`Pandoc finished, but output HTML file not found for "${file.originalname}" at: "${outputHtmlPath}"`);
        }
        let htmlContent = await fsExtra.readFile(outputHtmlPath, 'utf8');
        console.log(`Successfully read HTML content from "${outputHtmlPath}" for "${file.originalname}". Content length: ${htmlContent.length} bytes`);

        const $ = cheerio.load(htmlContent);

        // --- 1. Remove specific body styles from inline <style> tags ---
        $('head style').each((index, element) => {
            let styleContent = $(element).html();
            const propertiesToRemove = [
                'margin:[^;]*;?',
                'max-width:[^;]*;?',
                'padding-left:[^;]*;?',
                'padding-right:[^;]*;?',
                'padding-top:[^;]*;?',
                'padding-bottom:[^;]*;?',
                'border-top:[^;]*;?',
                'border-bottom:[^;]*;?',
            ];
            styleContent = styleContent.replace(
                /(body\s*\{[^}]*)/s,
                (match, bodyRuleBlock) => {
                    let modifiedBodyRuleBlock = bodyRuleBlock;
                    propertiesToRemove.forEach(propRegexStr => {
                        const regex = new RegExp(`\\s*${propRegexStr}`, 'g');
                        modifiedBodyRuleBlock = modifiedBodyRuleBlock.replace(regex, '');
                    });
                    return modifiedBodyRuleBlock;
                }
            );
            $(element).html(styleContent);
        });

        // --- 2. Remove borders from tables, tbody, and their cells ---
        $('table, tbody, th, td').each((index, element) => {
            const $el = $(element);
            const style = $el.attr('style');
            if (style) {
                const newStyle = style.replace(/(border(?:(?:-(?:top|bottom|left|right))?|-(?:style|width|color))?:\s*[^;]+;?\s*)|(outline:\s*[^;]+;?\s*)/gi, '');
                $el.attr('style', newStyle);
            }
            if (element.tagName.toLowerCase() === 'table') {
                $el.removeAttr('border');
                $el.removeAttr('cellspacing');
                $el.removeAttr('cellpadding');
            }
        });

        $('head style').each((index, element) => {
            let styleContent = $(element).html();
            const tableBorderRegex = /(table\s*\{[^}]*)|(tbody\s*\{[^}]*)|(th\s*\{[^}]*)|(td\s*\{[^}]*)/gs;
            styleContent = styleContent.replace(tableBorderRegex, (match, tableRule, tbodyRule, thRule, tdRule) => {
                let modifiedRule = match;
                const borderPropertiesToRemove = [
                    'border-collapse:[^;]*;?',
                    'border(?:(?:-(?:top|bottom|left|right))?|-(?:style|width|color))?:\s*[^;]+;?\s*',
                    'outline:\s*[^;]+;?\s*'
                ];
                borderPropertiesToRemove.forEach(propRegexStr => {
                    const regex = new RegExp(propRegexStr, 'gi');
                    modifiedRule = modifiedRule.replace(regex, '');
                });
                return modifiedRule;
            });
            $(element).html(styleContent);
        });

        // --- NEW STEP: Enforce <p> tags inside <th> and <td> elements by wrapping all content ---
        $('th, td').each((index, element) => {
            const $cell = $(element);
            // Check if the cell already contains a <p> tag as its direct child
            const hasParagraphDirectly = $cell.children('p').length > 0 && $cell.children().length === 1;

            if (!hasParagraphDirectly) {
                // Get all current content (including text nodes and other elements)
                const currentContentHtml = $cell.html();

                // Create a new <p> tag and put all the content inside it
                const $newP = $('<p>');
                $newP.html(currentContentHtml);

                // Empty the original cell and append the new <p>
                $cell.empty().append($newP);
            }
            // If it already has a single <p> as its direct child and nothing else, leave it.
            // If it has multiple <p> or mixed content and you want only one, you'd need
            // to consolidate, which is more complex and might involve merging paragraphs.
            // This logic strictly ensures that if there's no single direct <p>, all content is moved into one.
        });


        const cleanedHtmlContent = $.html();

        await fsExtra.remove(outputHtmlPath);
        console.log(`Cleaned up output .html file for "${file.originalname}"`);

        return { filename: file.originalname, content: cleanedHtmlContent, status: 'success' };

    } catch (err) {
        console.error(`Error processing file "${file.originalname}": ${err.message}`);
        try {
            await fsExtra.remove(uploadedTempPath);
            console.log(`Cleaned up original uploaded temp file for "${file.originalname}" on error.`);
        } catch (cleanupErr) {
            if (cleanupErr.code !== 'ENOENT') {
                console.error(`Error cleaning up original uploaded file "${uploadedTempPath}" on top-level error for "${file.originalname}": ${cleanupErr.message}`);
            }
        }
        return { filename: file.originalname, error: err.message, status: 'failed' };
    }
}

app.post("/upload", upload.array("files"), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded." });
    }

    console.log(`Received ${req.files.length} files for upload.`);

    const processingPromises = req.files.map(file => processSingleFile(file));

    try {
        const results = await Promise.all(processingPromises);

        const successfulContents = results.filter(r => r.status === 'success');
        const failedContents = results.filter(r => r.status === 'failed');

        if (successfulContents.length > 0) {
            res.json({
                contents: successfulContents,
                failed: failedContents.length > 0 ? failedContents : undefined
            });
        } else {
            res.status(500).json({
                error: "All files failed to convert.",
                failed: failedContents
            });
        }

    } catch (overallError) {
        console.error("Overall error during multiple file processing:", overallError);
        res.status(500).json({
            error: "An unexpected error occurred during file processing.",
            details: overallError.message
        });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} `));