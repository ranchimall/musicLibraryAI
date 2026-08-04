// -----------------------------------------
// Upload Flow (Suno Scraper)
// -----------------------------------------

let currentUploadTrackData = null;

async function fetchSunoData() {
  const linkInput = document.getElementById("suno_link_input");
  const fetchBtn = document.getElementById("fetch_suno_btn");
  const previewCard = document.getElementById("upload_preview_card");
  let originalBtnHtml = fetchBtn.innerHTML;

  if (!linkInput.value || !linkInput.value.includes("suno.com")) {
    showToast("Please enter a valid Suno link.", "warning");
    return;
  }

  try {
    fetchBtn.innerHTML =
      '<span class="material-symbols-outlined text-[14px] animate-spin">refresh</span>';
    fetchBtn.classList.add("opacity-50", "pointer-events-none");
    previewCard.classList.add("hidden");

    let targetUrl = linkInput.value.trim();

    // use a CORS proxy to fetch Suno HTML from the browser
    const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);

    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error("Failed to fetch from Suno via proxy");

    const html = await response.text();

    // Extract UUID. The final URL is usually in the canonical meta tag or og:url
    let uuid = null;
    const canonicalMatch = html.match(
      /<link rel="canonical" href="https:\/\/suno\.com\/song\/([a-f0-9\-]{36})"/i,
    );
    if (canonicalMatch) {
      uuid = canonicalMatch[1];
    } else {
      // fallback, maybe it was already a direct song URL
      const urlMatch = targetUrl.match(/song\/([a-f0-9\-]{36})/i);
      if (urlMatch) uuid = urlMatch[1];
    }

    if (!uuid) throw new Error("Could not extract song ID from the page.");

    // Extract Metadata
    const titleMatch = html.match(
      /<meta property="og:title" content="([^"]+)"/i,
    );
    const title = titleMatch ? titleMatch[1] : "Unknown Title";

    const imageMatch = html.match(
      /<meta property="og:image" content="([^"]+)"/i,
    );
    const image = imageMatch
      ? imageMatch[1]
      : `https://cdn2.suno.ai/image_large_${uuid}.jpeg`;

    const audioUrl = `https://cdn1.suno.ai/${uuid}.mp3`;

    // Extract Play Count
    let playCount = 0;
    const playCountMatch = html.match(/play_count\\?["']?\s*:\s*(\d+)/i);
    if (playCountMatch) {
      playCount = parseInt(playCountMatch[1], 10);
    }

    // Extract Lyrics (prompt)
    let lyrics = "";
    const promptMatch = html.match(
      /\\?"prompt\\?"\s*:\s*\\?"(.*?)(?<!\\)\\?"/i,
    );
    if (promptMatch) {
      lyrics = promptMatch[1]
        .replace(/\\\\n/g, "\n")
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .trim();
    }

    // Extract Artist Name
    let artist = "Unknown";
    // The <title> format is always: "Song Title by Artist Name | Suno"
    const titleFullMatch = html.match(/<title>.*? by (.*?) \| Suno<\/title>/i);
    if (titleFullMatch) {
      artist = titleFullMatch[1];
    } else {
      // Fallback to meta description: "Song Title by Artist Name (@handle)"
      const descMatch = html.match(
        /<meta name="description" content=".*? by (.*?) \(@/i,
      );
      if (descMatch) artist = descMatch[1];
    }

    // Store data globally for publishing
    currentUploadTrackData = {
      uuid,
      title,
      artist,
      image,
      audioUrl,
      playCount,
      lyrics,
      sourceUrl: targetUrl,
    };

    // Update UI
    document.getElementById("preview_title").textContent = title;
    document.getElementById("preview_artist").textContent = "by " + artist;
    document.getElementById("preview_image").src = image;
    document.getElementById("preview_plays").textContent =
      playCount.toLocaleString();
    document.getElementById("preview_lyrics_status").textContent = lyrics
      ? "Included"
      : "None";

    previewCard.classList.remove("hidden");
  } catch (err) {
    showToast("Failed to fetch track data.", "error");
    console.error(err);
  } finally {
    fetchBtn.innerHTML = originalBtnHtml;
    fetchBtn.classList.remove("opacity-50", "pointer-events-none");
  }
}

async function publishTrack() {
  if (!currentUploadTrackData) return;

  // Prevent duplicate uploads
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
      cover: currentUploadTrackData.image,
      sunoUrl: currentUploadTrackData.sourceUrl,
      playCount: currentUploadTrackData.playCount,
    };

    // Write to Supernode Cloud
    await floCloudAPI.sendApplicationData(trackData, "MusicMarketplace_Track");

    // Keep local track list in sync immediately
    TRACKS.unshift({
      id: trackData.id,
      title: trackData.title,
      artist: trackData.artist,
      audio: trackData.audio,
      img: trackData.cover,
      sunoUrl: trackData.sunoUrl,
      playCount: trackData.playCount,
    });

    showToast("Track published successfully.");
    document.getElementById("suno_link_input").value = "";
    document.getElementById("upload_preview_card").classList.add("hidden");
    currentUploadTrackData = null;

    // Refresh the tracks list if it's implemented (or just route to explore)
    if (typeof loadTracksFromCloud === "function") {
      await loadTracksFromCloud();
    }

    // Redirect to library or explore
    routeTo("page_explore");
  } catch (err) {
    showToast("Failed to publish track.", "error");
    console.error(err);
  } finally {
    publishBtn.innerHTML = originalBtnHtml;
    publishBtn.classList.remove("opacity-50", "pointer-events-none");
  }
}
