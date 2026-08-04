// Simple micro-interaction for track cards
document.querySelectorAll(".glass-panel").forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);
  });
});

// Audio Player Logic
const audio = new Audio();
audio.src = "";

// Desktop elements
const playBtn = document.getElementById("player_play_btn");
const playIcon = document.getElementById("player_play_icon");
const progressContainer = document.getElementById("player_progress_container");
const progressBar = document.getElementById("player_progress_bar");
const currentTimeEl = document.getElementById("player_current_time");
const durationEl = document.getElementById("player_duration");
const muteBtn = document.getElementById("player_mute_btn");
const volumeIcon = document.getElementById("player_volume_icon");
const volumeContainer = document.getElementById("player_volume_container");
const volumeBar = document.getElementById("player_volume_bar");

// Mobile elements
const playBtnMobile = document.getElementById("player_play_btn_mobile");
const playIconMobile = document.getElementById("player_play_icon_mobile");
const progressContainerMobile = document.getElementById(
  "player_progress_container_mobile",
);
const progressBarMobile = document.getElementById("player_progress_bar_mobile");

function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function togglePlayPause() {
  if (audio.paused) {
    audio.play();
    playIcon.textContent = "pause";
    playIconMobile.textContent = "pause";
    const trackDetailPlayIcon = document.getElementById(
      "track_detail_play_icon",
    );
    if (trackDetailPlayIcon) trackDetailPlayIcon.textContent = "pause";
  } else {
    audio.pause();
    playIcon.textContent = "play_arrow";
    playIconMobile.textContent = "play_arrow";
    const trackDetailPlayIcon = document.getElementById(
      "track_detail_play_icon",
    );
    if (trackDetailPlayIcon) trackDetailPlayIcon.textContent = "play_arrow";
  }
}

playBtn.addEventListener("click", togglePlayPause);
playBtnMobile.addEventListener("click", togglePlayPause);

// Also link the track detail play button
const trackDetailPlayBtn = document.getElementById("track_detail_play_btn");
if (trackDetailPlayBtn)
  trackDetailPlayBtn.addEventListener("click", togglePlayPause);

audio.addEventListener("timeupdate", () => {
  const current = audio.currentTime;
  const duration = audio.duration;
  currentTimeEl.textContent = formatTime(current);

  const trackDetailCurrentTime = document.getElementById(
    "track_detail_current_time",
  );
  if (trackDetailCurrentTime)
    trackDetailCurrentTime.textContent = formatTime(current);

  if (duration) {
    const percent = (current / duration) * 100;
    progressBar.style.width = `${percent}%`;
    progressBarMobile.style.width = `${percent}%`;

    const trackDetailProgressBar = document.getElementById(
      "track_detail_progress_bar",
    );
    if (trackDetailProgressBar)
      trackDetailProgressBar.style.width = `${percent}%`;
  }
});

audio.addEventListener("loadedmetadata", () => {
  const durStr = formatTime(audio.duration);
  durationEl.textContent = durStr;

  const trackDetailDuration = document.getElementById("track_detail_duration");
  if (trackDetailDuration) trackDetailDuration.textContent = durStr;
  const trackDetailDurationText = document.getElementById(
    "track_detail_duration_text",
  );
  if (trackDetailDurationText) trackDetailDurationText.textContent = durStr;
});

audio.addEventListener("ended", () => {
  playIcon.textContent = "play_arrow";
  playIconMobile.textContent = "play_arrow";
  progressBar.style.width = `0%`;
  progressBarMobile.style.width = `0%`;

  const trackDetailPlayIcon = document.getElementById("track_detail_play_icon");
  if (trackDetailPlayIcon) trackDetailPlayIcon.textContent = "play_arrow";
  const trackDetailProgressBar = document.getElementById(
    "track_detail_progress_bar",
  );
  if (trackDetailProgressBar) trackDetailProgressBar.style.width = `0%`;

  audio.currentTime = 0;
});

// Volume controls
function updateVolumeUI() {
  if (!volumeIcon || !volumeBar) return;
  if (audio.muted || audio.volume === 0) {
    volumeIcon.textContent = "volume_off";
    volumeBar.style.width = "0%";
  } else if (audio.volume < 0.5) {
    volumeIcon.textContent = "volume_down";
    volumeBar.style.width = audio.volume * 100 + "%";
  } else {
    volumeIcon.textContent = "volume_up";
    volumeBar.style.width = audio.volume * 100 + "%";
  }
}

if (muteBtn) {
  muteBtn.addEventListener("click", () => {
    audio.muted = !audio.muted;
    updateVolumeUI();
  });
}

if (volumeContainer) {
  volumeContainer.addEventListener("click", (e) => {
    const rect = volumeContainer.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    audio.volume = x / rect.width;
    audio.muted = false;
    updateVolumeUI();
  });
}

function seekAudio(e, container) {
  const rect = container.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const width = rect.width;
  const percent = clickX / width;
  audio.currentTime = percent * audio.duration;
}

progressContainer.addEventListener("click", (e) =>
  seekAudio(e, progressContainer),
);
progressContainerMobile.addEventListener("click", (e) =>
  seekAudio(e, progressContainerMobile),
);

// Mobile Player Fullscreen Toggle Logic
const mobilePlayer = document.getElementById("mobile_player");
const mobilePlayerMini = document.getElementById("mobile_player_mini");
const mobilePlayerFull = document.getElementById("mobile_player_full");
const mobilePlayerClose = document.getElementById("mobile_player_close");

// Elements to update in full screen
const playBtnFull = document.getElementById("player_play_btn_full");
const playIconFull = document.getElementById("player_play_icon_full");
const progressContainerFull = document.getElementById(
  "player_progress_container_full",
);
const progressBarFull = document.getElementById("player_progress_bar_full");
const currentTimeFull = document.getElementById("player_current_time_full");
const durationFull = document.getElementById("player_duration_full");

if (playBtnFull) {
  playBtnFull.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePlayPause();
  });
}

if (progressContainerFull) {
  progressContainerFull.addEventListener("click", (e) => {
    e.stopPropagation();
    seekAudio(e, progressContainerFull);
  });
}

// Prevent clicks on mini play button from opening full screen
if (playBtnMobile) {
  playBtnMobile.addEventListener("click", (e) => {
    e.stopPropagation();
    // togglePlayPause is already attached earlier, but we just need to stop propagation here
  });
}
const likeBtnMobile = document.getElementById("player_like_btn_mobile");
if (likeBtnMobile) {
  likeBtnMobile.addEventListener("click", (e) => {
    e.stopPropagation();
  });
}

function openMobileFullscreen() {
  if (window.innerWidth >= 768) return; // Only on mobile
  mobilePlayerMini.classList.add("opacity-0", "pointer-events-none", "hidden");
  mobilePlayerFull.classList.remove("hidden");

  // Allow display to register before fading in
  setTimeout(() => {
    mobilePlayerFull.classList.remove("opacity-0", "pointer-events-none");
  }, 10);

  // Change footer to cover screen
  const footer = document.getElementById("audio_player_footer");
  footer.classList.remove("bottom-16", "h-auto");
  footer.classList.add("bottom-0", "h-[100dvh]", "z-[100]");
}

function closeMobileFullscreen(e) {
  if (e) e.stopPropagation();
  mobilePlayerFull.classList.add("opacity-0", "pointer-events-none");

  setTimeout(() => {
    mobilePlayerFull.classList.add("hidden");
    mobilePlayerMini.classList.remove("hidden");
    setTimeout(() => {
      mobilePlayerMini.classList.remove("opacity-0", "pointer-events-none");
    }, 10);
  }, 300);

  // Restore footer
  const footer = document.getElementById("audio_player_footer");
  footer.classList.remove("bottom-0", "h-[100dvh]", "z-[100]");
  footer.classList.add("bottom-16");
}
window.closeMobileFullscreen = closeMobileFullscreen;

if (mobilePlayerMini) {
  mobilePlayerMini.addEventListener("click", openMobileFullscreen);
}
if (mobilePlayerClose) {
  mobilePlayerClose.addEventListener("click", closeMobileFullscreen);
}

function openDesktopLyrics() {
  const overlay = document.getElementById("desktop_lyrics_overlay");
  if (!overlay) return;

  const icon = document.getElementById("desktop_lyrics_icon");
  if (icon) {
    icon.classList.add("text-primary-fixed-dim", "glow-cyan");
    icon.style.fontVariationSettings = "'FILL' 1";
  }

  overlay.classList.remove("hidden");
  // Lock body scroll so only the lyrics area scrolls
  document.body.style.overflow = "hidden";
  setTimeout(() => {
    overlay.classList.remove("opacity-0", "pointer-events-none");
    // Auto-focus the scroll area so wheel events go to it
    const scrollArea = document.getElementById("lyrics_scroll_area");
    if (scrollArea) scrollArea.focus({ preventScroll: true });
  }, 10);
}
window.openDesktopLyrics = openDesktopLyrics;

function closeDesktopLyrics() {
  const overlay = document.getElementById("desktop_lyrics_overlay");
  if (!overlay) return;

  const icon = document.getElementById("desktop_lyrics_icon");
  if (icon) {
    icon.classList.remove("text-primary-fixed-dim", "glow-cyan");
    icon.style.fontVariationSettings = "'FILL' 0";
  }

  overlay.classList.add("opacity-0", "pointer-events-none");
  // Restore body scroll
  document.body.style.overflow = "";
  setTimeout(() => {
    overlay.classList.add("hidden");
  }, 300);
}
window.closeDesktopLyrics = closeDesktopLyrics;

// Override original play pause function to include full screen icon
const originalTogglePlayPause = togglePlayPause;
togglePlayPause = function () {
  originalTogglePlayPause();
  if (playIconFull) {
    playIconFull.textContent = audio.paused ? "play_arrow" : "pause";
  }
};

// Add timeupdate listener for full screen UI
audio.addEventListener("timeupdate", () => {
  const current = audio.currentTime;
  const duration = audio.duration;
  if (currentTimeFull) currentTimeFull.textContent = formatTime(current);
  if (duration && progressBarFull) {
    const percent = (current / duration) * 100;
    progressBarFull.style.width = `${percent}%`;
  }
});

audio.addEventListener("loadedmetadata", () => {
  if (durationFull) durationFull.textContent = formatTime(audio.duration);
});

audio.addEventListener("ended", () => {
  if (playIconFull) playIconFull.textContent = "play_arrow";
  if (progressBarFull) progressBarFull.style.width = `0%`;
});

function setLyricsLoadingState(stage) {
  const lyricsContainer = document.getElementById("lyrics_overlay_content");
  const mobileLyricsContainer = document.getElementById(
    "mobile_lyrics_preview",
  );

  let msg, mobileMsg;
  if (stage === "suno") {
    msg =
      '<p class="text-outline/50 animate-pulse">Fetching lyrics from Suno...</p>';
    mobileMsg =
      '<p class="text-outline/50 animate-pulse text-xs">Fetching lyrics...</p>';
  }

  if (lyricsContainer) lyricsContainer.innerHTML = msg;
  if (mobileLyricsContainer) mobileLyricsContainer.innerHTML = mobileMsg;
}

// ─── Main lyrics fetch: Suno API ──────────────────────────────────
async function fetchSunoLyrics(trackId) {
  // 1) Try SunoAPI.org — lyrics/record-info endpoint
  const SUNO_API_TOKEN = "b813e3d336b36344523c7290f77bc00b";
  try {
    const r = await fetch(
      `https://api.sunoapi.org/api/v1/lyrics/record-info?taskId=${trackId}`,
      {
        headers: { Authorization: `Bearer ${SUNO_API_TOKEN}` },
      },
    );
    if (r.ok) {
      const json = await r.json();
      if (json && json.data && json.data.length > 0 && json.data[0].text) {
        return { lyrics: json.data[0].text, source: "suno" };
      }
    }
  } catch (e) {
    console.warn("SunoAPI lyrics fetch failed:", e);
  }

  // 3) Try SunoAPI.org — generate/record-info endpoint (contains full track metadata incl. lyrics)
  try {
    const r = await fetch(
      `https://api.sunoapi.org/api/v1/generate/record-info?taskId=${trackId}`,
      {
        headers: { Authorization: `Bearer ${SUNO_API_TOKEN}` },
      },
    );
    if (r.ok) {
      const json = await r.json();
      // Look for lyrics in response.data[0].response.sunoData[0].lyric
      const firstResult = json?.data?.[0]?.response?.sunoData?.[0];
      if (firstResult?.lyric) {
        return { lyrics: firstResult.lyric, source: "suno" };
      }
    }
  } catch (e) {
    console.warn("SunoAPI generate/record-info failed:", e);
  }

  // 4) Lyrics not on Suno — signal to use Whisper
  return null;
}

// Next / Prev buttons
const prevBtn = document.getElementById("player_prev_btn");
const nextBtn = document.getElementById("player_next_btn");

const prevBtnFull = document.getElementById("player_prev_btn_full");
const nextBtnFull = document.getElementById("player_next_btn_full");
const prevBtnMobile = document.getElementById("player_prev_btn_mobile");
const nextBtnMobile = document.getElementById("player_next_btn_mobile");

function handlePrevTrack(e) {
  if (e) e.stopPropagation();
  if (currentTrackIndex > 0) {
    const t = TRACKS[currentTrackIndex - 1];
    playTrack(t.audio, t.title, t.artist, t.img);
  } else if (currentTrackIndex === 0 && TRACKS.length > 0) {
    // loop to end
    const t = TRACKS[TRACKS.length - 1];
    playTrack(t.audio, t.title, t.artist, t.img);
  }
}

function handleNextTrack(e) {
  if (e) e.stopPropagation();
  if (currentTrackIndex >= 0 && currentTrackIndex < TRACKS.length - 1) {
    const t = TRACKS[currentTrackIndex + 1];
    playTrack(t.audio, t.title, t.artist, t.img);
  } else if (currentTrackIndex === TRACKS.length - 1 && TRACKS.length > 0) {
    // loop to start
    const t = TRACKS[0];
    playTrack(t.audio, t.title, t.artist, t.img);
  }
}

if (prevBtn) prevBtn.addEventListener("click", handlePrevTrack);
if (prevBtnFull) prevBtnFull.addEventListener("click", handlePrevTrack);
if (prevBtnMobile) prevBtnMobile.addEventListener("click", handlePrevTrack);

if (nextBtn) nextBtn.addEventListener("click", handleNextTrack);
if (nextBtnFull) nextBtnFull.addEventListener("click", handleNextTrack);
if (nextBtnMobile) nextBtnMobile.addEventListener("click", handleNextTrack);

// ─── Lyrics UI Update ──────────────────────────────────────────────
function updateLyricsUI(lyricsText) {
  const lyricsContainer = document.getElementById("lyrics_overlay_content");
  const mobileLyricsContainer = document.getElementById(
    "mobile_lyrics_preview",
  );
  const trackDetailLyricsContainer = document.getElementById(
    "track_detail_lyrics_container",
  );

  if (!lyricsText) {
    if (lyricsContainer)
      lyricsContainer.innerHTML =
        '<div class="flex items-center justify-center h-full w-full py-32"><h1 class="text-4xl md:text-6xl lg:text-7xl font-black text-white text-center tracking-tighter" style="line-height: 1.1;">Hmm. We don\'t know<br/>the lyrics for this one.</h1></div>';
    if (mobileLyricsContainer)
      mobileLyricsContainer.innerHTML =
        '<p class="text-outline/50 text-xs">Lyrics unavailable.</p>';
    if (trackDetailLyricsContainer)
      trackDetailLyricsContainer.innerHTML =
        '<p class="text-outline/40">Lyrics not added yet.</p>';
    return;
  }

  // Split lyrics by newlines and create paragraph elements
  const lines = lyricsText.split("\n").filter((line) => line.trim().length > 0);

  let html = "";
  let mobileHtml = "";
  lines.forEach((line, index) => {
    // For demo, just make the first few lines active
    if (index === 0) {
      html += `<p class="text-white font-black text-4xl md:text-5xl lg:text-7xl tracking-tighter transition-all duration-300 cursor-pointer origin-left hover:scale-[1.02]">${line}</p>`;
      mobileHtml += `<p class="text-primary-fixed-dim font-bold drop-shadow-[0_0_8px_rgba(0,219,233,0.5)]">${line}</p>`;
    } else {
      html += `<p class="text-black/60 font-black text-4xl md:text-5xl lg:text-7xl tracking-tighter transition-all duration-300 cursor-pointer hover:text-white/80">${line}</p>`;
      mobileHtml += `<p>${line}</p>`;
    }
  });

  if (lyricsContainer) lyricsContainer.innerHTML = html;
  if (mobileLyricsContainer) mobileLyricsContainer.innerHTML = mobileHtml;
  if (trackDetailLyricsContainer) trackDetailLyricsContainer.innerHTML = html;
}

let TRACKS = [];

window.loadTracksFromCloud = async function () {
  try {
    console.log("Loading tracks from cloud...");
    // Ensure floGlobals is ready
    if (typeof floGlobals === "undefined" || !floGlobals.application) {
      console.warn("floGlobals.application not set yet. Retrying in 1s...");
      setTimeout(loadTracksFromCloud, 1000);
      return;
    }

    // requestGeneralData returns delta. The full data is stored in floGlobals.generalDataset
    await floCloudAPI.requestGeneralData("MusicMarketplace_Track");
    const data = floGlobals.generalDataset("MusicMarketplace_Track");

    console.log("Cloud data received:", data);

    TRACKS = [];
    const grid = document.getElementById("explore_track_grid");
    if (grid)
      grid.innerHTML =
        '<div class="col-span-full text-center text-outline py-8">Loading tracks...</div>';

    if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
      console.warn("No tracks found in cloud.");
      if (grid)
        grid.innerHTML =
          '<div class="col-span-full text-center text-outline py-8">No tracks found. Be the first to upload!</div>';
      return;
    }

    let html = "";
    const vcs = Object.keys(data).sort().reverse();

    for (let vc of vcs) {
      const track = data[vc];
      if (!track || !track.message) continue;
      const t = track.message;

      const title = t.title || "Unknown Title";
      const artist = t.artist || "Unknown Artist";
      const cover = t.cover || "";
      const audio = t.audio || "";

      const safeTitle = title.replace(/'/g, "\\'");
      const safeArtist = artist.replace(/'/g, "\\'");

      TRACKS.push({
        audio: audio,
        title: title,
        artist: artist,
        img: cover,
        sunoUrl: t.sunoUrl,
        id: t.id,
      });

      html += `
                            <div class="glass-panel rounded-xl p-md group cursor-pointer hover:border-primary-fixed-dim/40 transition-all flex flex-col"
                                onclick="playTrack('${audio}', '${safeTitle}', '${safeArtist}', '${cover}')">
                                <div class="relative aspect-square mb-md overflow-hidden rounded-lg">
                                    <img class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        alt="${title} by ${artist}"
                                        src="${cover}" />
                                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div class="w-16 h-16 rounded-full bg-primary-fixed-dim text-on-primary flex items-center justify-center shadow-lg">
                                            <span class="material-symbols-outlined text-4xl" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
                                        </div>
                                    </div>
                                    <div class="absolute top-sm right-sm flex flex-col gap-xs items-end">
                                        <span class="px-xs py-base bg-black/80 rounded border border-white/10 font-code-sm text-code-sm text-primary-fixed-dim">SUNO AI MUSIC</span>
                                    </div>
                                </div>
                                <div class="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 class="font-headline-md text-xl text-on-surface mb-xs">${title}</h3>
                                        <div class="flex items-center gap-2 mt-1">
                                            <span class="px-2 py-1 bg-surface-container-low rounded border border-white/5 font-code-sm text-[10px] text-outline uppercase">Lyrics: <span class="text-secondary-fixed-dim">HUMAN/AI</span></span>
                                            <span class="px-2 py-1 bg-surface-container-low rounded border border-white/5 font-code-sm text-[10px] text-outline uppercase">Music: <span class="text-primary-fixed-dim">AI (SUNO)</span></span>
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-auto pt-md border-t border-white/5 flex items-center justify-between">
                                    <div class="flex flex-col overflow-hidden max-w-[70%]">
                                        <span class="font-label-caps text-[9px] text-outline uppercase tracking-widest mb-1">Artist</span>
                                        <span class="font-code-sm text-xs text-primary-fixed-dim truncate" title="${artist}">${artist}</span>
                                    </div>
                                    <div class="flex items-center gap-4">
                                        <div class="flex flex-col items-center text-center">
                                            <span class="font-label-caps text-[9px] text-outline uppercase tracking-widest mb-1">Market Plays</span>
                                            <span id="marketplays-${t.id}" class="font-code-sm text-sm text-primary-fixed-dim" title="Native platform plays">---</span>
                                        </div>
                                        <div class="flex flex-col items-center text-center">
                                            <span class="font-label-caps text-[9px] text-outline uppercase tracking-widest mb-1">Suno Plays</span>
                                            <span id="sunoplays-${t.id}" class="font-code-sm text-sm text-on-surface text-primary-fixed-dim" title="Loading live stats...">${t.playCount ? t.playCount.toLocaleString() : "---"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
    }

    if (grid) {
      grid.innerHTML = html;
      setTimeout(() => fetchLivePlaysQueue(TRACKS), 2000);
    }
  } catch (err) {
    console.error("Failed to load tracks from cloud:", err);
    const grid = document.getElementById("explore_track_grid");
    if (grid)
      grid.innerHTML =
        '<div class="col-span-full text-center text-red-400 py-8">Error loading tracks. See console.</div>';
  }
};

// Wait for app initialization before loading tracks

setTimeout(loadTracksFromCloud, 2000);

let currentTrackIndex = -1;

// Play a track (updates both mobile and desktop UI)

let currentPlayingUUID = null;
let currentLyricsCache = {};

async function preloadLyrics(uuid) {
  if (currentLyricsCache[uuid]) {
    renderLyrics(currentLyricsCache[uuid]);
    return;
  }

  try {
    const proxyUrl =
      "https://corsproxy.io/?" +
      encodeURIComponent("https://suno.com/song/" + uuid);
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error("Failed to fetch");
    const html = await response.text();

    let lyrics = "No lyrics available for this track (Instrumental).";
    const promptMatch = html.match(
      /\\?"prompt\\?"\s*:\s*\\?"(.*?)(?<!\\)\\?"/i,
    );
    if (promptMatch) {
      const extracted = promptMatch[1]
        .replace(/\\\\n/g, "\n")
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .trim();
      if (extracted) lyrics = extracted;
    }

    currentLyricsCache[uuid] = lyrics;

    // Only render if this is still the currently playing track
    if (currentPlayingUUID === uuid) {
      renderLyrics(lyrics);
    }
  } catch (err) {
    console.error(err);
    if (currentPlayingUUID === uuid) {
      const preview = document.getElementById("mobile_lyrics_preview");
      if (preview)
        preview.innerHTML =
          '<p class="text-error text-sm">Failed to load lyrics.</p>';
    }
  }
}

window.openDesktopLyrics = async function () {
  const modal = document.getElementById("lyrics_modal");
  const content = document.getElementById("lyrics_modal_content");
  if (!modal || !content) return;

  modal.classList.remove("hidden");
  modal.classList.add("flex");

  if (!currentPlayingUUID) {
    content.innerHTML =
      '<p class="text-white text-center py-10 font-body-base">No track is currently playing.</p>';
    return;
  }

  if (currentLyricsCache[currentPlayingUUID]) {
    renderLyrics(currentLyricsCache[currentPlayingUUID]);
    return;
  }

  content.innerHTML = `<div class="flex items-center gap-2 text-primary-fixed-dim justify-center py-20">
                    <span class="material-symbols-outlined animate-spin text-3xl">refresh</span>
                    <span class="font-label-caps tracking-widest text-sm">FETCHING FROM SUNO...</span>
                </div>`;

  try {
    const proxyUrl =
      "https://corsproxy.io/?" +
      encodeURIComponent("https://suno.com/song/" + currentPlayingUUID);
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error("Failed to fetch");
    const html = await response.text();

    let lyrics = "No lyrics available for this track.";
    const promptMatch = html.match(
      /\\?"prompt\\?"\s*:\s*\\?"(.*?)(?<!\\)\\?"/i,
    );
    if (promptMatch) {
      lyrics = promptMatch[1]
        .replace(/\\\\n/g, "\n")
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .trim();
      if (!lyrics)
        lyrics = "No lyrics available for this track (Instrumental).";
    }

    currentLyricsCache[currentPlayingUUID] = lyrics;
    renderLyrics(lyrics);
  } catch (err) {
    console.error(err);
    content.innerHTML =
      '<p class="text-error text-center py-10 font-body-base">Failed to load lyrics. Please try again.</p>';
  }
};

window.closeDesktopLyrics = function () {
  const modal = document.getElementById("lyrics_modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

function renderLyrics(lyricsText) {
  const content = document.getElementById("lyrics_modal_content");
  const preview = document.getElementById("mobile_lyrics_preview");

  // Format for HTML
  const htmlFormatted = lyricsText
    .split("\n")
    .map((line) =>
      line.trim() === ""
        ? "<br>"
        : `<p class="mb-2 font-body-base text-lg text-white/90 hover:text-white transition-colors">${line}</p>`,
    )
    .join("");

  if (content) content.innerHTML = htmlFormatted;
  if (preview) preview.innerHTML = htmlFormatted;
}

window.playTrack = function (audioUrl, title, artist, imgUrl) {
  currentTrackIndex = TRACKS.findIndex((t) => t.audio === audioUrl);
  const track = TRACKS[currentTrackIndex];

  // Immediately increment platform plays in DB and UI
  if (track && track.id) {
    fetch(
      `${API_BASE_URL}/api/platform-plays?id=${encodeURIComponent(track.id)}`,
      { method: "POST" },
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const marketEl = document.getElementById(`marketplays-${track.id}`);
          if (marketEl) marketEl.textContent = data.playCount.toLocaleString();
        }
      })
      .catch(console.error);
  }

  const uuidMatch = audioUrl.match(/([a-f0-9\-]{36})\.mp3/i);
  currentPlayingUUID = uuidMatch ? uuidMatch[1] : null;

  // Clear mobile lyrics preview
  const preview = document.getElementById("mobile_lyrics_preview");
  if (preview)
    preview.innerHTML = '<p class="text-outline/50">Load lyrics to view...</p>';

  if (audio.src !== audioUrl) {
    audio.src = audioUrl;
  }
  audio.currentTime = 0;

  // Reveal the player
  const playerFooter = document.getElementById("audio_player_footer");
  if (playerFooter) {
    playerFooter.classList.remove(
      "translate-y-full",
      "opacity-0",
      "pointer-events-none",
    );
  }

  progressBar.style.width = "0%";
  progressBarMobile.style.width = "0%";
  if (progressBarFull) progressBarFull.style.width = "0%";

  currentTimeEl.textContent = "0:00";
  if (currentTimeFull) currentTimeFull.textContent = "0:00";

  durationEl.textContent = "...";
  if (durationFull) durationFull.textContent = "...";

  audio.play().catch((e) => console.error("Playback failed:", e));
  playIcon.textContent = "pause";
  playIconMobile.textContent = "pause";
  if (playIconFull) playIconFull.textContent = "pause";

  // Update desktop
  if (title) document.getElementById("player_track_title").textContent = title;
  if (artist)
    document.getElementById("player_track_artist").textContent = artist;
  if (imgUrl) document.getElementById("player_track_img").src = imgUrl;

  // Update mobile (mini)
  if (title)
    document.getElementById("player_track_title_mobile").textContent = title;
  if (artist)
    document.getElementById("player_track_artist_mobile").textContent = artist;
  if (imgUrl) document.getElementById("player_track_img_mobile").src = imgUrl;

  // Update mobile (full)
  if (title) {
    const titleFull = document.getElementById("player_track_title_full");
    if (titleFull) titleFull.textContent = title;
  }
  if (artist) {
    const artistFull = document.getElementById("player_track_artist_full");
    if (artistFull) artistFull.textContent = artist;
  }
  if (imgUrl) {
    const imgFull = document.getElementById("player_track_img_full");
    if (imgFull) imgFull.src = imgUrl;
  }

  // Update desktop lyrics overlay
  if (title) {
    const overlayTitle = document.getElementById("lyrics_overlay_title");
    if (overlayTitle) overlayTitle.textContent = title;
  }
  if (artist) {
    const overlayArtist = document.getElementById("lyrics_overlay_artist");
    if (overlayArtist) overlayArtist.textContent = artist;
  }
  if (imgUrl) {
    const overlayImg = document.getElementById("lyrics_overlay_img");
    if (overlayImg) overlayImg.src = imgUrl;
  }

  // Update Track Detail Page
  if (title) {
    const detailTitle = document.getElementById("track_detail_title");
    if (detailTitle) detailTitle.textContent = title;
    const rowTitle = document.getElementById("track_detail_row_title");
    if (rowTitle) rowTitle.textContent = title;
  }
  if (artist) {
    const detailArtist = document.getElementById("track_detail_artist");
    if (detailArtist) detailArtist.textContent = artist;
    const rowArtist = document.getElementById("track_detail_row_artist");
    if (rowArtist) rowArtist.textContent = artist;
  }
  if (imgUrl) {
    const detailImg = document.getElementById("track_detail_img");
    // Check if it's an img tag or div with background
    if (detailImg) {
      if (detailImg.tagName.toLowerCase() === "img") {
        detailImg.src = imgUrl;
      } else {
        detailImg.style.backgroundImage = `url('${imgUrl}')`;
      }
    }
  }

  // Auto-fetch lyrics for mobile preview & cache
  if (currentPlayingUUID) {
    preloadLyrics(currentPlayingUUID);
  }
};

window.playSunoTrack = function (trackId) {
  playTrack(`https://cdn1.suno.ai/${trackId}.mp3`);
};

// Helper to test full Suno links directly
window.playSunoURL = function (url) {
  const match = url.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  if (match) {
    playSunoTrack(match[0]);
    console.log("Streaming Suno Track:", match[0]);
  } else {
    console.error("Invalid Suno URL. Could not find track ID.");
    showToast("Please enter a valid Suno link.", "warning");
  }
};

window.customElements.define(
  "keys-generator",
  class extends HTMLElement {
    constructor() {
      super();
      this.appendChild(
        document.getElementById("generateKeys").content.cloneNode(true),
      );
    }
    get keys() {
      return {
        floID:
          this.querySelector("#generated_flo_address").getAttribute("value") ||
          this.querySelector("#generated_flo_address").value,
        privKey:
          this.querySelector("#generated_private_key").getAttribute("value") ||
          this.querySelector("#generated_private_key").value,
      };
    }

    generateKeys() {
      const { floID, privKey } = floCrypto.generateNewID();
      this.querySelector("#generated_flo_address").setAttribute("value", floID);
      this.querySelector("#generated_private_key").setAttribute(
        "value",
        privKey,
      );
      this.querySelector("#generated_flo_address").value = floID;
      this.querySelector("#generated_private_key").value = privKey;
    }
    clearKeys() {
      this.querySelector("#generated_flo_address").setAttribute("value", "");
      this.querySelector("#generated_private_key").setAttribute("value", "");
      this.querySelector("#generated_flo_address").value = "";
      this.querySelector("#generated_private_key").value = "";
    }

    connectedCallback() {
      this.querySelector("#sign_up_button").onclick = () => {
        const privKey = this.keys.privKey;
        if (privKey) {
          document.getElementById("private_key_input").value = privKey;
          document
            .getElementById("keys_generator_container")
            .classList.add("hidden");
          document.getElementById("verify_key_btn").click();
        }
      };

      // Add copy animation on click (fallback for clipboard API failure)
      this.querySelectorAll("sm-copy").forEach((copyElem) => {
        copyElem.addEventListener("click", () => {
         showToast("Copied","success");
        });
      });
    }
  },
);

// ─── Authentication & Key Generation ───────────────────────────────────
// Generate new FLO keys automatically when the user clicks 'New here?'
const newHereLink = document.querySelector(
  'a[onclick*="keys_generator_container"]',
);
if (newHereLink) {
  newHereLink.onclick = (e) => {
    e.preventDefault();
    const container = document.getElementById("keys_generator_container");
    const generator = document.getElementById("keys_generator");
    container.classList.remove("hidden");
    generator.generateKeys();
  };
}
async function fetchLivePlaysQueue(tracks) {
  if (!tracks || tracks.length === 0) return;
  console.log("Starting background lazy-load for live plays...");

  for (let track of tracks) {
    if (!track.sunoUrl || !track.id) continue;

    try {
      // 1. Fetch Suno Plays from Oracle
      const sunoRes = await fetch(
        `${API_BASE_URL}/api/suno-plays?url=${encodeURIComponent(track.sunoUrl)}`,
      );
      let sunoPlays = 0;
      if (sunoRes.ok) {
        const data = await sunoRes.json();
        sunoPlays = data.playCount || track.playCount || 0;
      } else {
        sunoPlays = track.playCount || 0;
      }

      // 2. Fetch Native Platform Plays
      const platformRes = await fetch(
        `${API_BASE_URL}/api/platform-plays?id=${encodeURIComponent(track.id)}`,
      );
      let platformPlays = 0;
      if (platformRes.ok) {
        const pData = await platformRes.json();
        platformPlays = pData.playCount || 0;
      }

      // 3. Update DOM
      const sunoEl = document.getElementById(`sunoplays-${track.id}`);
      if (sunoEl) {
        sunoEl.textContent = sunoPlays.toLocaleString();
        sunoEl.classList.add("text-secondary-fixed-dim");
      }

      const marketEl = document.getElementById(`marketplays-${track.id}`);
      if (marketEl) {
        marketEl.textContent = platformPlays.toLocaleString();
        // Store raw number for instant incrementing
        marketEl.setAttribute("data-plays", platformPlays);
      }
    } catch (e) {
      console.warn("Failed to lazy load plays for", track.id, e);
    }

    // Wait briefly between requests
    await new Promise((r) => setTimeout(r, 1000));
  }
}
