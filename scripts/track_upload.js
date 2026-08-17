// -----------------------------------------
// Helps upload tracks from various places easily.
// Currently works with Suno and Google Flow Music.
// -----------------------------------------

let currentUploadTrackData = null;

// Settings for different platforms so we know how to handle them.
const PLATFORM_CONFIG = {
  suno: {
    match: (url) => /suno\.com/i.test(url),
    badge: "SUNO AI MUSIC",
    tag: "AI (SUNO)",
    playsLabel: "Suno Plays",
  },
  flowmusic: {
    match: (url) => /flowmusic\.app/i.test(url),
    badge: "GOOGLE FLOW MUSIC",
    tag: "AI (FLOW)",
    playsLabel: "Flow Plays",
  },
};
window.PLATFORM_CONFIG = PLATFORM_CONFIG;

function detectPlatform(url) {
  return (
    Object.keys(PLATFORM_CONFIG).find((key) =>
      PLATFORM_CONFIG[key].match(url),
    ) || null
  );
}

// ---- Getting details from Suno ----
function extractSunoData(html, targetUrl) {
  const canonicalMatch = html.match(
    /<link rel="canonical" href="https:\/\/suno\.com\/song\/([a-f0-9\-]{36})"/i,
  );
  let uuid = canonicalMatch ? canonicalMatch[1] : null;
  if (!uuid) {
    const urlMatch = targetUrl.match(/song\/([a-f0-9\-]{36})/i);
    if (urlMatch) uuid = urlMatch[1];
  }
  if (!uuid) throw new Error("Could not extract song ID from the page.");

  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
  const title = titleMatch ? titleMatch[1] : "Unknown Title";

  const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
  const image = imageMatch
    ? imageMatch[1]
    : `https://cdn2.suno.ai/image_large_${uuid}.jpeg`;

  let audioUrl = `https://cdn1.suno.ai/${uuid}.mp3`;

  let playCount = 0;
  const playCountMatch = html.match(/play_count\\?["']?\s*:\s*(\d+)/i);
  if (playCountMatch) playCount = parseInt(playCountMatch[1], 10);

  // We try our best to figure out if there are vocals, assuming yes by default.
  let hasVocals = true;
  const hasVocalMatch = html.match(/has_vocal\\?["']?\s*:\s*(true|false)/i);
  if (hasVocalMatch) hasVocals = hasVocalMatch[1] === "true";

  let lyrics = "";
  const promptMatch = html.match(
    /\\?"prompt\\?"\s*:\s*\\?"([\s\S]*?)(?<!\\)\\?"/i,
  );
  if (promptMatch) {
    lyrics = promptMatch[1]
      .replace(/\\\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .trim();

    if (/^\$[a-zA-Z0-9]+$/.test(lyrics)) {
      const ref = lyrics.slice(1);
      const pushBlocks =
        html.match(/self\.__next_f\.push\(\[[\s\S]*?\]\);?/g) || [];
      const refBlock = pushBlocks.find((block) => block.includes(`${ref}:`));

      if (refBlock) {
        const match = refBlock.match(
          new RegExp(`${ref}:[^,]*,([\\s\\S]*?)"\\]\\)`),
        );
        if (match) {
          lyrics = match[1]
            .replace(/^[A-Za-z0-9]+:[^,]+,/, "")
            .replace(/^[A-Za-z0-9]+,/, "")
            .replace(/\\\\n/g, "\n")
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\")
            .replace(/\\?"?\]\);?$/, "")
            .trim();
        }
      }
    }
  }

  let artist = "Unknown";
  const titleFullMatch = html.match(/<title>.*? by (.*?) \| Suno<\/title>/i);
  if (titleFullMatch) {
    artist = titleFullMatch[1];
  } else {
    const descMatch = html.match(
      /<meta name="description" content=".*? by (.*?) \(@/i,
    );
    if (descMatch) artist = descMatch[1];
  }

  return {
    uuid,
    title,
    artist,
    image,
    audioUrl,
    playCount,
    lyrics,
    hasVocals,
    sourceUrl: targetUrl,
    platform: "suno",
  };
}

// ---- Getting details from Google Flow Music ----
// We grab the important information right off their page so it's ready to use.

async function extractFlowMusicData(html, targetUrl) {
  // ---------------------------------------------------------
  // 1. Find the song's unique identifier
  // ---------------------------------------------------------
  const urlMatch = targetUrl.match(/\/song\/([a-f0-9-]{36})/i);

  const uuid = urlMatch ? urlMatch[1] : null;

  if (!uuid) {
    throw new Error("Could not extract song ID from the Flow link.");
  }

  // ---------------------------------------------------------
  // 2. Get the basic info we need
  // ---------------------------------------------------------
  const audioMatch = html.match(
    /<meta\s+property=["']og:audio["']\s+content=["']([^"']+)["']/i,
  );

  let audioUrl = audioMatch ? audioMatch[1] : null;

  if (!audioUrl) {
    throw new Error("Could not find an audio URL on the Flow page.");
  }

  const imageMatch = html.match(
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
  );

  let image = imageMatch ? imageMatch[1] : "";

  const videoMatch = html.match(
    /<meta\s+property=["']og:video["']\s+content=["']([^"']+)["']/i,
  );

  let videoUrl = videoMatch ? videoMatch[1] : "";

  const artistMatch = html.match(
    /<meta\s+property=["']music:musician["']\s+content=["']([^"']+)["']/i,
  );

  const artist = artistMatch ? artistMatch[1] : "Unknown";

  const titleMatch = html.match(
    /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
  );

  let title = titleMatch ? titleMatch[1] : "Unknown Title";

  // Remove " by Artist" from OG title if Flow includes it
  const bySuffix = ` by ${artist}`;

  if (artist !== "Unknown" && title.endsWith(bySuffix)) {
    title = title.slice(0, -bySuffix.length);
  }

  // ---------------------------------------------------------
  // 3. See if we can find out who made this
  // ---------------------------------------------------------

  let authorId = null;

  const authorMatch =
    html.match(/"author_id"\s*:\s*"([a-f0-9-]{36})"/i) ||
    html.match(/"authorId"\s*:\s*"([a-f0-9-]{36})"/i);

  if (authorMatch) {
    authorId = authorMatch[1];
  }

  // ---------------------------------------------------------
  // 4. Try another way to find the creator if the first didn't work
  // ---------------------------------------------------------

  if (!authorId) {
    const profileImageMatch = html.match(
      /producer-app-public\/user-metadata\/([a-f0-9-]{36})\/profile\.jpg/i,
    );

    if (profileImageMatch) {
      authorId = profileImageMatch[1];
    }
  }

  console.log("Flow song ID:", uuid);
  console.log("Flow author ID:", authorId);

  // ---------------------------------------------------------
  // 5. Set up some starting defaults
  // ---------------------------------------------------------

  let playCount = 0;
  let lyrics = "";

  // ---------------------------------------------------------
  // 6. Grab what we can directly from the page
  // ---------------------------------------------------------

  const playCountMatch = html.match(
    /["'](?:playCount|plays|play_count)["']\s*:\s*(\d+)/i,
  );

  if (playCountMatch) {
    playCount = parseInt(playCountMatch[1], 10);
  }

  const lyricsMatch = html.match(
    /["']lyrics["']\s*:\s*["']((?:[^"'\\]|\\.)*)["']/i,
  );

  if (lyricsMatch) {
    lyrics = lyricsMatch[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\r/g, "")
      .trim();
  }

  // ---------------------------------------------------------
  // 7. If we know the creator, ask for more details
  // ---------------------------------------------------------

  if (authorId) {
    try {
      const flowApiUrl =
        `https://www.flowmusic.app/__api/clips/user/` +
        `${encodeURIComponent(authorId)}?public_only=true&limit=100`;

      console.log("Fetching Flow clips API:", flowApiUrl);

      /*
       * We use a helper to get around browser restrictions when asking for data.
       */

      const proxyUrl =
        "https://corsproxy.io/?" + encodeURIComponent(flowApiUrl);

      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error(`Flow clips API returned HTTP ${response.status}`);
      }

      const data = await response.json();

      console.log("Flow clips API response:", data);

      // -----------------------------------------------------
      // 8. Make sure we have the right song
      // -----------------------------------------------------

      const clips = data.clips || data.data || data.results || [];

      const clip = clips.find((item) => item && item.id === uuid);

      if (clip) {
        console.log("Found exact Flow clip:", clip);

        // ---------------------------------------------------
        // Get the lyrics
        // ---------------------------------------------------

        if (
          clip.lyrics &&
          typeof clip.lyrics === "object" &&
          clip.lyrics.value
        ) {
          if (typeof clip.lyrics.value === "string") {
            lyrics = clip.lyrics.value;
          } else if (clip.lyrics.value.text) {
            lyrics = clip.lyrics.value.text;
          }
        }

        // Fallback formats
        if (!lyrics && typeof clip.lyrics === "string") {
          lyrics = clip.lyrics;
        }

        // ---------------------------------------------------
        // How many times has this been played?
        // ---------------------------------------------------

        if (clip.play_count !== undefined) {
          playCount = Number(clip.play_count) || 0;
        } else if (clip.playCount !== undefined) {
          playCount = Number(clip.playCount) || 0;
        }

        // ---------------------------------------------------
        // Fill in anything that might be missing
        // ---------------------------------------------------

        if (clip.title) {
          title = clip.title;
        }

        if (clip.audio_url) {
          // Use this sound file if we didn't already find one.
          if (!audioUrl) {
            audioUrl = clip.audio_url;
          }
        }

        if (clip.image_url && !image) {
          image = clip.image_url;
        }

        // Flow animated cover
        if (!videoUrl) {
          const videoMatch = html.match(
            /<meta\s+property=["']og:video["']\s+content=["']([^"']+)["']/i,
          );

          if (videoMatch) {
            videoUrl = videoMatch[1];
          }
        }

        console.log("Flow lyrics extracted:", lyrics ? "YES" : "NO");

        console.log("Flow play count:", playCount);
      } else {
        console.warn(`Could not find Flow clip ${uuid} in author clips`);
      }
    } catch (error) {
      console.warn("Flow clips API extraction failed:", error);
    }
  } else {
    console.warn("Could not determine Flow author ID.");
  }

  // ---------------------------------------------------------
  // 9. Hand back everything we collected
  // ---------------------------------------------------------

  return {
    uuid,
    title,
    artist,
    image,
    audioUrl,
    videoUrl,
    playCount,
    lyrics,
    // We assume it has vocals by default since it's hard to tell for sure.
    hasVocals: true,
    sourceUrl: targetUrl,
    platform: "flowmusic",
    authorId,
  };
}

async function fetchTrackData() {
  const linkInput = document.getElementById("track_link_input");
  const fetchBtn = document.getElementById("fetch_track_btn");
  const previewCard = document.getElementById("upload_preview_card");
  let originalBtnHtml = fetchBtn.innerHTML;

  const targetUrl = (linkInput.value || "").trim();
  const platform = detectPlatform(targetUrl);

  if (!targetUrl || !platform) {
    showToast("Please enter a valid Suno or Flow Music link.", "warning");
    return;
  }

  try {
    fetchBtn.innerHTML =
      '<span class="material-symbols-outlined text-[14px] animate-spin">refresh</span>';
    fetchBtn.classList.add("opacity-50", "pointer-events-none");
    previewCard.classList.add("hidden");

    // We use a helpful service to grab the page contents smoothly.
    const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error("Failed to fetch the page via proxy");

    const html = await response.text();

    const extractor =
      platform === "suno" ? extractSunoData : extractFlowMusicData;
    currentUploadTrackData = await extractor(html, targetUrl);

    // Update UI
    document.getElementById("preview_title").textContent =
      currentUploadTrackData.title;
    document.getElementById("preview_artist").textContent =
      "by " + currentUploadTrackData.artist;
    const previewImage = document.getElementById("preview_image");
    const previewVideo = document.getElementById("preview_video");

    if (currentUploadTrackData.videoUrl) {
      previewImage.classList.add("hidden");

      previewVideo.src = currentUploadTrackData.videoUrl;
      previewVideo.classList.remove("hidden");

      previewVideo.load();
      previewVideo.play().catch(() => {});
    } else {
      previewVideo.pause();
      previewVideo.removeAttribute("src");
      previewVideo.load();
      previewVideo.classList.add("hidden");

      previewImage.src = currentUploadTrackData.image;
      previewImage.classList.remove("hidden");
    }
    document.getElementById("preview_plays").textContent =
      currentUploadTrackData.playCount.toLocaleString();
    document.getElementById("preview_lyrics_status").textContent =
      currentUploadTrackData.lyrics ? "Included" : "None";

    // Let the user type in lyrics themselves if we couldn't find any.
    const manualLyricsSection = document.getElementById(
      "manual_lyrics_section",
    );
    const manualLyricsInput = document.getElementById("manual_lyrics_input");
    const extractedLyricsSection = document.getElementById(
      "extracted_lyrics_section",
    );
    const previewLyricsText = document.getElementById("preview_lyrics_text");

    manualLyricsInput.value = "";
    if (currentUploadTrackData.lyrics) {
      manualLyricsSection.classList.add("hidden");
      extractedLyricsSection.classList.remove("hidden");
      previewLyricsText.textContent = currentUploadTrackData.lyrics;
    } else {
      manualLyricsSection.classList.remove("hidden");
      extractedLyricsSection.classList.add("hidden");
      previewLyricsText.textContent = "";
    }

    previewCard.classList.remove("hidden");
  } catch (err) {
    showToast("Failed to fetch track data.", "error");
    console.error(err);
  } finally {
    fetchBtn.innerHTML = originalBtnHtml;
    fetchBtn.classList.remove("opacity-50", "pointer-events-none");
  }
}

// Updates the track with lyrics as the user types them in.
function onManualLyricsInput() {
  const manualLyricsInput = document.getElementById("manual_lyrics_input");
  if (!currentUploadTrackData || !manualLyricsInput) return;

  currentUploadTrackData.lyrics = manualLyricsInput.value.trim();

  const statusEl = document.getElementById("preview_lyrics_status");
  if (statusEl) {
    statusEl.textContent = currentUploadTrackData.lyrics
      ? "Included (manual)"
      : "None";
  }
}
window.onManualLyricsInput = onManualLyricsInput;

// Fills out the choices for categories when someone goes to upload a track.
async function loadUploadCategories() {
  const select = document.getElementById("upload_category_select");
  if (!select) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/categories`);
    const data = await res.json();
    if (!data.success || !data.categories.length) {
      select.innerHTML = `<option value="">No categories yet</option>`;
      return;
    }

    select.innerHTML = data.categories
      .map((c) => `<option value="${c.slug}">${c.name}</option>`)
      .join("");
  } catch (err) {
    console.error("Failed to load categories:", err);
    select.innerHTML = `<option value="">Failed to load categories</option>`;
  }
}
window.loadUploadCategories = loadUploadCategories;

// Tells the marketplace about this track so it can be discovered.
// It tries its best, but won't ruin the whole upload if something minor goes wrong.
async function registerTrackComponents(trackId, categorySlug, trackData) {
  if (!categorySlug) return;

  const componentsToRegister = ["music"];
  if (trackData.lyrics) componentsToRegister.push("lyrics");
  if (trackData.hasVocals) componentsToRegister.push("vocals");

  for (const componentType of componentsToRegister) {
    try {
      await marketplaceRegisterComponent(trackId, categorySlug, componentType);
    } catch (err) {
      console.error(`Failed to register ${componentType} component:`, err);
    }
  }
}

async function publishTrack() {
  if (!currentUploadTrackData) return;

  // Don't let the same track get added twice.
  if (
    Array.isArray(TRACKS) &&
    TRACKS.some((track) => track.id === currentUploadTrackData.uuid)
  ) {
    showToast("This track has already been published.", "warning");
    return;
  }

  const publishBtn = document.getElementById("publish_track_btn");
  const originalBtnHtml = publishBtn.innerHTML;

  publishBtn.innerHTML =
    '<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span> WRITING TO CLOUD...';
  publishBtn.classList.add("opacity-50", "pointer-events-none");

  try {
    const trackData = {
      id: currentUploadTrackData.uuid,
      title: currentUploadTrackData.title,
      artist: currentUploadTrackData.artist,
      audio: currentUploadTrackData.audioUrl,
      videoUrl: currentUploadTrackData.videoUrl || "",
      cover: currentUploadTrackData.image,
      sourceUrl: currentUploadTrackData.sourceUrl,
      playCount: currentUploadTrackData.playCount,
      platform: currentUploadTrackData.platform,
      lyrics: currentUploadTrackData.lyrics || "",
    };

    // Save the track online safely.
    await floCloudAPI.sendApplicationData(trackData, "MusicLibrary_Track");

    // List this track in the marketplace if a category is chosen.
    const categorySlug = document.getElementById("upload_category_select")?.value;
    if (categorySlug) {
      await registerTrackComponents(trackData.id, categorySlug, currentUploadTrackData);
    } else {
      console.warn("No category selected - track will not be registered as a marketplace component.");
    }

    // Update what we see here right away so it feels instant.
    TRACKS.unshift({
      id: trackData.id,
      title: trackData.title,
      artist: trackData.artist,
      audio: trackData.audio,
      videoUrl: trackData.videoUrl,
      img: trackData.cover,
      sourceUrl: trackData.sourceUrl,
      playCount: trackData.playCount,
      platform: trackData.platform,
      lyrics: trackData.lyrics,
    });

    showToast("Track published successfully.");
    document.getElementById("track_link_input").value = "";
    document.getElementById("upload_preview_card").classList.add("hidden");
    document.getElementById("manual_lyrics_section").classList.add("hidden");
    document
      .getElementById("extracted_lyrics_section")
      ?.classList.add("hidden");
    document.getElementById("manual_lyrics_input").value = "";
    currentUploadTrackData = null;

    // Get the latest tracks if we can, then move along.
    if (typeof loadTracksFromCloud === "function") {
      await loadTracksFromCloud();
    }

    // Take the user to see the music.
    routeTo("page_explore");
  } catch (err) {
    showToast("Failed to publish track.", "error");
    console.error(err);
  } finally {
    publishBtn.innerHTML = originalBtnHtml;
    publishBtn.classList.remove("opacity-50", "pointer-events-none");
  }
}
window.fetchTrackData = fetchTrackData;
window.publishTrack = publishTrack;