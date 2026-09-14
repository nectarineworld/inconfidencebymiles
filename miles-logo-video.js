// Effet identique à la home du site inconfidencebymiles.com :
// le logo 3D joue UNE rotation complète chaque fois que l'utilisateur scrolle
// (delta > 10px), puis se remet en pause sur la première frame.
(function () {
  var videos = document.querySelectorAll('.miles-logo-video');
  if (!videos.length) return;

  videos.forEach(function (video) {
    var isPlaying = false;
    video.pause();
    video.currentTime = 0;

    function playOneRotation() {
      if (isPlaying) return;
      isPlaying = true;
      video.currentTime = 0;
      video.play().catch(function () {});
    }
    video.addEventListener('ended', function () {
      isPlaying = false;
      video.currentTime = 0;
      video.pause();
    });

    var lastScrollY = window.scrollY;
    var handler = function () {
      var currentScrollY = window.scrollY;
      var scrollDelta = Math.abs(currentScrollY - lastScrollY);
      if (scrollDelta > 10 && !isPlaying) playOneRotation();
      lastScrollY = currentScrollY;
    };
    window.addEventListener('scroll', handler, { passive: true });

    // Un petit tour au chargement, pour signaler que ça vit
    setTimeout(playOneRotation, 400);
  });
})();
