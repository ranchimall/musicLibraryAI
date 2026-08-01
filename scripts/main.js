
            // Simple micro-interaction for track cards
            document.querySelectorAll('.glass-panel').forEach(card => {
                card.addEventListener('mousemove', (e) => {
                    const rect = card.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    card.style.setProperty('--mouse-x', `${x}px`);
                    card.style.setProperty('--mouse-y', `${y}px`);
                });
            });

            // Audio Player Logic
            const audio = new Audio();
            audio.src = "";

            // Desktop elements
            const playBtn = document.getElementById('player_play_btn');
            const playIcon = document.getElementById('player_play_icon');
            const progressContainer = document.getElementById('player_progress_container');
            const progressBar = document.getElementById('player_progress_bar');
            const currentTimeEl = document.getElementById('player_current_time');
            const durationEl = document.getElementById('player_duration');
            const muteBtn = document.getElementById('player_mute_btn');
            const volumeIcon = document.getElementById('player_volume_icon');
            const volumeContainer = document.getElementById('player_volume_container');
            const volumeBar = document.getElementById('player_volume_bar');

            // Mobile elements
            const playBtnMobile = document.getElementById('player_play_btn_mobile');
            const playIconMobile = document.getElementById('player_play_icon_mobile');
            const progressContainerMobile = document.getElementById('player_progress_container_mobile');
            const progressBarMobile = document.getElementById('player_progress_bar_mobile');

            function formatTime(seconds) {
                if (isNaN(seconds)) return "0:00";
                const min = Math.floor(seconds / 60);
                const sec = Math.floor(seconds % 60);
                return `${min}:${sec.toString().padStart(2, '0')}`;
            }

            function togglePlayPause() {
                if (audio.paused) {
                    audio.play();
                    playIcon.textContent = 'pause';
                    playIconMobile.textContent = 'pause';
                    const trackDetailPlayIcon = document.getElementById('track_detail_play_icon');
                    if (trackDetailPlayIcon) trackDetailPlayIcon.textContent = 'pause';
                } else {
                    audio.pause();
                    playIcon.textContent = 'play_arrow';
                    playIconMobile.textContent = 'play_arrow';
                    const trackDetailPlayIcon = document.getElementById('track_detail_play_icon');
                    if (trackDetailPlayIcon) trackDetailPlayIcon.textContent = 'play_arrow';
                }
            }

            playBtn.addEventListener('click', togglePlayPause);
            playBtnMobile.addEventListener('click', togglePlayPause);
            
            // Also link the track detail play button
            const trackDetailPlayBtn = document.getElementById('track_detail_play_btn');
            if (trackDetailPlayBtn) trackDetailPlayBtn.addEventListener('click', togglePlayPause);

            audio.addEventListener('timeupdate', () => {
                const current = audio.currentTime;
                const duration = audio.duration;
                currentTimeEl.textContent = formatTime(current);
                
                const trackDetailCurrentTime = document.getElementById('track_detail_current_time');
                if (trackDetailCurrentTime) trackDetailCurrentTime.textContent = formatTime(current);
                
                if (duration) {
                    const percent = (current / duration) * 100;
                    progressBar.style.width = `${percent}%`;
                    progressBarMobile.style.width = `${percent}%`;
                    
                    const trackDetailProgressBar = document.getElementById('track_detail_progress_bar');
                    if (trackDetailProgressBar) trackDetailProgressBar.style.width = `${percent}%`;
                }
            });

            audio.addEventListener('loadedmetadata', () => {
                const durStr = formatTime(audio.duration);
                durationEl.textContent = durStr;
                
                const trackDetailDuration = document.getElementById('track_detail_duration');
                if (trackDetailDuration) trackDetailDuration.textContent = durStr;
                const trackDetailDurationText = document.getElementById('track_detail_duration_text');
                if (trackDetailDurationText) trackDetailDurationText.textContent = durStr;
            });

            audio.addEventListener('ended', () => {
                playIcon.textContent = 'play_arrow';
                playIconMobile.textContent = 'play_arrow';
                progressBar.style.width = `0%`;
                progressBarMobile.style.width = `0%`;
                
                const trackDetailPlayIcon = document.getElementById('track_detail_play_icon');
                if (trackDetailPlayIcon) trackDetailPlayIcon.textContent = 'play_arrow';
                const trackDetailProgressBar = document.getElementById('track_detail_progress_bar');
                if (trackDetailProgressBar) trackDetailProgressBar.style.width = `0%`;
                
                audio.currentTime = 0;
            });

            // Volume controls
            function updateVolumeUI() {
                if (!volumeIcon || !volumeBar) return;
                if (audio.muted || audio.volume === 0) {
                    volumeIcon.textContent = 'volume_off';
                    volumeBar.style.width = '0%';
                } else if (audio.volume < 0.5) {
                    volumeIcon.textContent = 'volume_down';
                    volumeBar.style.width = (audio.volume * 100) + '%';
                } else {
                    volumeIcon.textContent = 'volume_up';
                    volumeBar.style.width = (audio.volume * 100) + '%';
                }
            }

            if(muteBtn) {
                muteBtn.addEventListener('click', () => {
                    audio.muted = !audio.muted;
                    updateVolumeUI();
                });
            }

            if(volumeContainer) {
                volumeContainer.addEventListener('click', (e) => {
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

            progressContainer.addEventListener('click', (e) => seekAudio(e, progressContainer));
            progressContainerMobile.addEventListener('click', (e) => seekAudio(e, progressContainerMobile));

            // Mobile Player Fullscreen Toggle Logic
            const mobilePlayer = document.getElementById('mobile_player');
            const mobilePlayerMini = document.getElementById('mobile_player_mini');
            const mobilePlayerFull = document.getElementById('mobile_player_full');
            const mobilePlayerClose = document.getElementById('mobile_player_close');
            
            // Elements to update in full screen
            const playBtnFull = document.getElementById('player_play_btn_full');
            const playIconFull = document.getElementById('player_play_icon_full');
            const progressContainerFull = document.getElementById('player_progress_container_full');
            const progressBarFull = document.getElementById('player_progress_bar_full');
            const currentTimeFull = document.getElementById('player_current_time_full');
            const durationFull = document.getElementById('player_duration_full');

            if(playBtnFull) {
                playBtnFull.addEventListener('click', (e) => {
                    e.stopPropagation();
                    togglePlayPause();
                });
            }

            if(progressContainerFull) {
                progressContainerFull.addEventListener('click', (e) => {
                    e.stopPropagation();
                    seekAudio(e, progressContainerFull);
                });
            }

            // Prevent clicks on mini play button from opening full screen
            if(playBtnMobile) {
                playBtnMobile.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // togglePlayPause is already attached earlier, but we just need to stop propagation here
                });
            }
            const likeBtnMobile = document.getElementById('player_like_btn_mobile');
            if(likeBtnMobile) {
                likeBtnMobile.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }

            function openMobileFullscreen() {
                if(window.innerWidth >= 768) return; // Only on mobile
                mobilePlayerMini.classList.add('opacity-0', 'pointer-events-none', 'hidden');
                mobilePlayerFull.classList.remove('hidden');
                
                // Allow display to register before fading in
                setTimeout(() => {
                    mobilePlayerFull.classList.remove('opacity-0', 'pointer-events-none');
                }, 10);

                // Change footer to cover screen
                const footer = document.getElementById('audio_player_footer');
                footer.classList.remove('bottom-16', 'h-auto');
                footer.classList.add('bottom-0', 'h-[100dvh]', 'z-[100]');
            }

            function closeMobileFullscreen(e) {
                if(e) e.stopPropagation();
                mobilePlayerFull.classList.add('opacity-0', 'pointer-events-none');
                
                setTimeout(() => {
                    mobilePlayerFull.classList.add('hidden');
                    mobilePlayerMini.classList.remove('hidden');
                    setTimeout(() => {
                        mobilePlayerMini.classList.remove('opacity-0', 'pointer-events-none');
                    }, 10);
                }, 300);

                // Restore footer
                const footer = document.getElementById('audio_player_footer');
                footer.classList.remove('bottom-0', 'h-[100dvh]', 'z-[100]');
                footer.classList.add('bottom-16');
            }
            window.closeMobileFullscreen = closeMobileFullscreen;

            if(mobilePlayerMini) {
                mobilePlayerMini.addEventListener('click', openMobileFullscreen);
            }
            if(mobilePlayerClose) {
                mobilePlayerClose.addEventListener('click', closeMobileFullscreen);
            }

            function openDesktopLyrics() {
                const overlay = document.getElementById('desktop_lyrics_overlay');
                if(!overlay) return;
                
                const icon = document.getElementById('desktop_lyrics_icon');
                if (icon) {
                    icon.classList.add('text-primary-fixed-dim', 'glow-cyan');
                    icon.style.fontVariationSettings = "'FILL' 1";
                }

                overlay.classList.remove('hidden');
                // Lock body scroll so only the lyrics area scrolls
                document.body.style.overflow = 'hidden';
                setTimeout(() => {
                    overlay.classList.remove('opacity-0', 'pointer-events-none');
                    // Auto-focus the scroll area so wheel events go to it
                    const scrollArea = document.getElementById('lyrics_scroll_area');
                    if (scrollArea) scrollArea.focus({ preventScroll: true });
                }, 10);
            }
            window.openDesktopLyrics = openDesktopLyrics;

            function closeDesktopLyrics() {
                const overlay = document.getElementById('desktop_lyrics_overlay');
                if(!overlay) return;
                
                const icon = document.getElementById('desktop_lyrics_icon');
                if (icon) {
                    icon.classList.remove('text-primary-fixed-dim', 'glow-cyan');
                    icon.style.fontVariationSettings = "'FILL' 0";
                }

                overlay.classList.add('opacity-0', 'pointer-events-none');
                // Restore body scroll
                document.body.style.overflow = '';
                setTimeout(() => {
                    overlay.classList.add('hidden');
                }, 300);
            }
            window.closeDesktopLyrics = closeDesktopLyrics;

            // Override original play pause function to include full screen icon
            const originalTogglePlayPause = togglePlayPause;
            togglePlayPause = function() {
                originalTogglePlayPause();
                if(playIconFull) {
                    playIconFull.textContent = audio.paused ? 'play_arrow' : 'pause';
                }
            };
            
            // Add timeupdate listener for full screen UI
            audio.addEventListener('timeupdate', () => {
                const current = audio.currentTime;
                const duration = audio.duration;
                if(currentTimeFull) currentTimeFull.textContent = formatTime(current);
                if (duration && progressBarFull) {
                    const percent = (current / duration) * 100;
                    progressBarFull.style.width = `${percent}%`;
                }
            });

            audio.addEventListener('loadedmetadata', () => {
                if(durationFull) durationFull.textContent = formatTime(audio.duration);
            });

            audio.addEventListener('ended', () => {
                if(playIconFull) playIconFull.textContent = 'play_arrow';
                if(progressBarFull) progressBarFull.style.width = `0%`;
            });



            function setLyricsLoadingState(stage) {
                const lyricsContainer = document.getElementById('lyrics_overlay_content');
                const mobileLyricsContainer = document.getElementById('mobile_lyrics_preview');

                let msg, mobileMsg;
                if (stage === 'suno') {
                    msg = '<p class="text-outline/50 animate-pulse">Fetching lyrics from Suno...</p>';
                    mobileMsg = '<p class="text-outline/50 animate-pulse text-xs">Fetching lyrics...</p>';
                }

                if (lyricsContainer) lyricsContainer.innerHTML = msg;
                if (mobileLyricsContainer) mobileLyricsContainer.innerHTML = mobileMsg;
            }

            // ─── Main lyrics fetch: Suno API ──────────────────────────────────
            async function fetchSunoLyrics(trackId) {
                // 1) Try SunoAPI.org — lyrics/record-info endpoint
                const SUNO_API_TOKEN = "b813e3d336b36344523c7290f77bc00b";
                try {
                    const r = await fetch(`https://api.sunoapi.org/api/v1/lyrics/record-info?taskId=${trackId}`, {
                        headers: { 'Authorization': `Bearer ${SUNO_API_TOKEN}` }
                    });
                    if (r.ok) {
                        const json = await r.json();
                        if (json && json.data && json.data.length > 0 && json.data[0].text) {
                            return { lyrics: json.data[0].text, source: 'suno' };
                        }
                    }
                } catch (e) {
                    console.warn('SunoAPI lyrics fetch failed:', e);
                }

                // 3) Try SunoAPI.org — generate/record-info endpoint (contains full track metadata incl. lyrics)
                try {
                    const r = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${trackId}`, {
                        headers: { 'Authorization': `Bearer ${SUNO_API_TOKEN}` }
                    });
                    if (r.ok) {
                        const json = await r.json();
                        // Look for lyrics in response.data[0].response.sunoData[0].lyric
                        const firstResult = json?.data?.[0]?.response?.sunoData?.[0];
                        if (firstResult?.lyric) {
                            return { lyrics: firstResult.lyric, source: 'suno' };
                        }
                    }
                } catch (e) {
                    console.warn('SunoAPI generate/record-info failed:', e);
                }

                // 4) Lyrics not on Suno — signal to use Whisper
                return null;
            }

            // Next / Prev buttons
            const prevBtn = document.getElementById('player_prev_btn');
            const nextBtn = document.getElementById('player_next_btn');
            
            const prevBtnFull = document.getElementById('player_prev_btn_full');
            const nextBtnFull = document.getElementById('player_next_btn_full');
            const prevBtnMobile = document.getElementById('player_prev_btn_mobile');
            const nextBtnMobile = document.getElementById('player_next_btn_mobile');

            function handlePrevTrack(e) {
                if(e) e.stopPropagation();
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
                if(e) e.stopPropagation();
                if (currentTrackIndex >= 0 && currentTrackIndex < TRACKS.length - 1) {
                    const t = TRACKS[currentTrackIndex + 1];
                    playTrack(t.audio, t.title, t.artist, t.img);
                } else if (currentTrackIndex === TRACKS.length - 1 && TRACKS.length > 0) {
                    // loop to start
                    const t = TRACKS[0];
                    playTrack(t.audio, t.title, t.artist, t.img);
                }
            }

            if (prevBtn) prevBtn.addEventListener('click', handlePrevTrack);
            if (prevBtnFull) prevBtnFull.addEventListener('click', handlePrevTrack);
            if (prevBtnMobile) prevBtnMobile.addEventListener('click', handlePrevTrack);
            
            if (nextBtn) nextBtn.addEventListener('click', handleNextTrack);
            if (nextBtnFull) nextBtnFull.addEventListener('click', handleNextTrack);
            if (nextBtnMobile) nextBtnMobile.addEventListener('click', handleNextTrack);

            // ─── Lyrics UI Update ──────────────────────────────────────────────
            function updateLyricsUI(lyricsText) {
                const lyricsContainer = document.getElementById('lyrics_overlay_content');
                const mobileLyricsContainer = document.getElementById('mobile_lyrics_preview');
                const trackDetailLyricsContainer = document.getElementById('track_detail_lyrics_container');
                
                if (!lyricsText) {
                    if (lyricsContainer) lyricsContainer.innerHTML = '<div class="flex items-center justify-center h-full w-full py-32"><h1 class="text-4xl md:text-6xl lg:text-7xl font-black text-white text-center tracking-tighter" style="line-height: 1.1;">Hmm. We don\'t know<br/>the lyrics for this one.</h1></div>';
                    if (mobileLyricsContainer) mobileLyricsContainer.innerHTML = '<p class="text-outline/50 text-xs">Lyrics unavailable.</p>';
                    if (trackDetailLyricsContainer) trackDetailLyricsContainer.innerHTML = '<p class="text-outline/40">Lyrics not added yet.</p>';
                    return;
                }

                // Split lyrics by newlines and create paragraph elements
                const lines = lyricsText.split('\n').filter(line => line.trim().length > 0);
                
                let html = '';
                let mobileHtml = '';
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

            const TRACKS = [
                { audio: 'https://cdn1.suno.ai/533891f1-205a-4e7a-a0be-c9e4e70aa1a5.mp3', title: 'हर कोई बिकेगा', artist: 'Nitin Khanapurkar', img: 'https://cdn1.suno.ai/sAura12.jpg' },
                { audio: 'https://cdn1.suno.ai/c5204867-f589-49a2-879d-485ef9130d12.mp3', title: 'राम राज का वादा (Fade In)', artist: 'Nitin Khanapurkar', img: 'https://cdn2.suno.ai/image_large_c5204867-f589-49a2-879d-485ef9130d12.jpeg' },
                { audio: 'https://cdn1.suno.ai/4fb9d4e0-4cf5-4aa1-b854-ea1b6ceaf4ed.mp3', title: 'खोल डाल फोड डाल', artist: 'Nitin Khanapurkar', img: 'https://cdn1.suno.ai/sAura22.jpg' },
                { audio: 'https://cdn1.suno.ai/038e5e31-d099-461e-b556-f09bc2797709.mp3', title: 'गली गली बस शोर है (Fade In)', artist: 'Nitin Khanapurkar', img: 'https://cdn2.suno.ai/image_large_038e5e31-d099-461e-b556-f09bc2797709.jpeg' },
                { audio: 'https://cdn1.suno.ai/4a16cd69-f13e-4903-a4fb-cba770ac91f7.mp3', title: 'पैलतीर तिथे वाळवंट', artist: 'Nitin Khanapurkar', img: 'https://cdn1.suno.ai/sAura6.jpg' },
                { audio: 'https://cdn1.suno.ai/3dbcd079-9e71-405d-afd9-80757e33fce8.mp3', title: 'अम्मी की सीख', artist: 'Nitin Khanapurkar', img: 'https://cdn1.suno.ai/sAura13.jpg' },
                { audio: 'https://cdn1.suno.ai/79de4830-2aab-427f-9f6b-6bd70bd1b678.mp3', title: 'समुंदर बनके रहूँगा', artist: 'Nitin Khanapurkar', img: 'https://cdn1.suno.ai/sAura9.jpg' },
                { audio: 'https://cdn1.suno.ai/541d7094-5af2-43e2-86bf-953c6e91016f.mp3', title: 'ज़ुस्तजू', artist: 'Nitin Khanapurkar', img: 'https://cdn1.suno.ai/sAura17.jpg' }
            ];
            let currentTrackIndex = -1;

            // Play a track (updates both mobile and desktop UI)
            window.playTrack = function (audioUrl, title, artist, imgUrl) {
                currentTrackIndex = TRACKS.findIndex(t => t.audio === audioUrl);
                
                if (audio.src !== audioUrl) {
                    audio.src = audioUrl;
                }
                audio.currentTime = 0;

                // Reveal the player
                const playerFooter = document.getElementById('audio_player_footer');
                if (playerFooter) {
                    playerFooter.classList.remove('translate-y-full', 'opacity-0', 'pointer-events-none');
                }

                progressBar.style.width = '0%';
                progressBarMobile.style.width = '0%';
                if(progressBarFull) progressBarFull.style.width = '0%';
                
                currentTimeEl.textContent = '0:00';
                if(currentTimeFull) currentTimeFull.textContent = '0:00';
                
                durationEl.textContent = '...';
                if(durationFull) durationFull.textContent = '...';

                audio.play().catch(e => console.error("Playback failed:", e));
                playIcon.textContent = 'pause';
                playIconMobile.textContent = 'pause';
                if(playIconFull) playIconFull.textContent = 'pause';

                // Update desktop
                if (title) document.getElementById('player_track_title').textContent = title;
                if (artist) document.getElementById('player_track_artist').textContent = artist;
                if (imgUrl) document.getElementById('player_track_img').src = imgUrl;

                // Update mobile (mini)
                if (title) document.getElementById('player_track_title_mobile').textContent = title;
                if (artist) document.getElementById('player_track_artist_mobile').textContent = artist;
                if (imgUrl) document.getElementById('player_track_img_mobile').src = imgUrl;

                // Update mobile (full)
                if (title) {
                    const titleFull = document.getElementById('player_track_title_full');
                    if(titleFull) titleFull.textContent = title;
                }
                if (artist) {
                    const artistFull = document.getElementById('player_track_artist_full');
                    if(artistFull) artistFull.textContent = artist;
                }
                if (imgUrl) {
                    const imgFull = document.getElementById('player_track_img_full');
                    if(imgFull) imgFull.src = imgUrl;
                }

                // Update desktop lyrics overlay
                if (title) {
                    const overlayTitle = document.getElementById('lyrics_overlay_title');
                    if(overlayTitle) overlayTitle.textContent = title;
                }
                if (artist) {
                    const overlayArtist = document.getElementById('lyrics_overlay_artist');
                    if(overlayArtist) overlayArtist.textContent = artist;
                }
                if (imgUrl) {
                    const overlayImg = document.getElementById('lyrics_overlay_img');
                    if(overlayImg) overlayImg.src = imgUrl;
                }

                // Update Track Detail Page
                if (title) {
                    const detailTitle = document.getElementById('track_detail_title');
                    if (detailTitle) detailTitle.textContent = title;
                    const rowTitle = document.getElementById('track_detail_row_title');
                    if (rowTitle) rowTitle.textContent = title;
                }
                if (artist) {
                    const detailArtist = document.getElementById('track_detail_artist');
                    if (detailArtist) detailArtist.textContent = artist;
                    const rowArtist = document.getElementById('track_detail_row_artist');
                    if (rowArtist) rowArtist.textContent = artist;
                }
                if (imgUrl) {
                    const detailImg = document.getElementById('track_detail_img');
                    // Check if it's an img tag or div with background
                    if (detailImg) {
                        if (detailImg.tagName.toLowerCase() === 'img') {
                            detailImg.src = imgUrl;
                        } else {
                            detailImg.style.backgroundImage = `url('${imgUrl}')`;
                        }
                    }
                }

                // Extract track ID from URL to fetch lyrics
                if (audioUrl.includes('suno.ai')) {
                    const match = audioUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
                    if (match) {
                        const trackId = match[0];
                        setLyricsLoadingState('suno');

                        fetchSunoLyrics(trackId).then(result => {
                            if (result && result.lyrics) {
                                // Got lyrics from Suno — display them
                                updateLyricsUI(result.lyrics);
                            } else {
                                // No Suno lyrics available
                                updateLyricsUI(null);
                            }
                        });
                    }
                }
            };

            window.playSunoTrack = function (trackId) {
                playTrack(`https://cdn1.suno.ai/${trackId}.mp3`);
            };

            // Helper to test full Suno links directly
            window.playSunoURL = function (url) {
                const match = url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
                if (match) {
                    playSunoTrack(match[0]);
                    console.log("Streaming Suno Track:", match[0]);
                } else {
                    console.error("Invalid Suno URL. Could not find track ID.");
                    alert("Please provide a valid Suno song link!");
                }
            };
        


        window.customElements.define('keys-generator', class extends HTMLElement {
            constructor() {
                super();
                this.appendChild(document.getElementById('generateKeys').content.cloneNode(true));
            }
            get keys() {
                return {
                    floID: this.querySelector('#generated_flo_address').getAttribute('value') || this.querySelector('#generated_flo_address').value,
                    privKey: this.querySelector('#generated_private_key').getAttribute('value') || this.querySelector('#generated_private_key').value
                }
            }

            generateKeys() {
                const { floID, privKey } = floCrypto.generateNewID()
                this.querySelector('#generated_flo_address').setAttribute('value', floID);
                this.querySelector('#generated_private_key').setAttribute('value', privKey);
                this.querySelector('#generated_flo_address').value = floID;
                this.querySelector('#generated_private_key').value = privKey;
            }
            clearKeys() {
                this.querySelector('#generated_flo_address').setAttribute('value', '');
                this.querySelector('#generated_private_key').setAttribute('value', '');
                this.querySelector('#generated_flo_address').value = '';
                this.querySelector('#generated_private_key').value = '';
            }

            connectedCallback() {
                this.querySelector('#sign_up_button').onclick = () => {
                    const privKey = this.keys.privKey;
                    if (privKey) {
                        document.getElementById('private_key_input').value = privKey;
                        document.getElementById('keys_generator_container').classList.add('hidden');
                        document.getElementById('verify_key_btn').click();
                    }
                };

                // Add copy animation on click (fallback for clipboard API failure)
                this.querySelectorAll('sm-copy').forEach(copyElem => {
                    copyElem.addEventListener('click', () => {
                        const btn = copyElem.shadowRoot ? copyElem.shadowRoot.querySelector('.copy-button') : null;
                        if (btn) {
                            const originalHTML = btn.innerHTML;
                            btn.innerHTML = 'COPIED!';
                            btn.style.color = '#00e5ff';
                            setTimeout(() => {
                                btn.innerHTML = originalHTML;
                                btn.style.color = '';
                            }, 1500);
                        } else {
                            copyElem.innerHTML = '<span slot="copy-icon" style="color:#00e5ff; transition:color 0.3s; font-weight:bold;">COPIED!</span>';
                            setTimeout(() => {
                                copyElem.innerHTML = '';
                            }, 1500);
                        }
                    });
                });
            }
        });

        // ─── Authentication & Key Generation ───────────────────────────────────
        // Generate new FLO keys automatically when the user clicks 'New here?'
        const newHereLink = document.querySelector('a[onclick*="keys_generator_container"]');
        if (newHereLink) {
            newHereLink.onclick = (e) => {
                e.preventDefault();
                const container = document.getElementById('keys_generator_container');
                const generator = document.getElementById('keys_generator');
                container.classList.remove('hidden');
                generator.generateKeys();
            };
        }
    