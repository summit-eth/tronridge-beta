(() => {
    
    let assets = [
        "images/bg-1.png",
        "images/bg-2.jpg",
        "images/bg-contract.jpg",
        "images/bg-dusts.png",
        "images/bg-nauts.png",
        "images/bg-nav.jpg",
        "images/bg-referrals.jpg",
        "images/bg-footer.png",
        "images/icon-dusts.png",
        "images/icon-dusts-small.png",
        "images/icon-nauts.png",
        "images/icon-nauts-small.png",
        "images/icon-trx-small.png",
        "images/logo-nav.png",
        "js/custom.js",
        "css/styles.css",
    ];
    
    let preloader = document.getElementById("preloader");
    
    let loaded = 0;
    
    let onLoad = () => {
        loaded++;
        // document.getElementById("preloader").innerHTML = loaded + "/" + assets.length;
        preloader.innerHTML = Math.ceil(loaded*100/assets.length) + "%";
        if(loaded >= assets.length) {
            // done
            let pc = document.getElementById("preloadContainer");
            setTimeout(() => {
                pc.style.opacity = "0";
                pc.style.transform = "scale(0.8)";
                document.getElementById("root").className = "loaded";
            }, 1500);
            setTimeout(() => {
                document.body.removeChild(pc);
            }, 2200);
        }
    };
    
    let getFileType = (file) => {
        file = file.split(".");
        return file[file.length-1];
    };
    
    // document.getElementById("preloader").innerHTML = loaded + "/" + assets.length;
    preloader.innerHTML = Math.ceil(loaded*100/assets.length) + "%";
    
    for(let i=0; i<assets.length; i++) {
        if(getFileType(assets[i]) == "js") {
            ((el, i) => {
                el.src = assets[i];
                el.onload = onLoad;
                document.body.appendChild(el);
            })(document.createElement("script"), i);
        } else if(getFileType(assets[i]) == "css") {
            ((el, i) => {
                el.rel = "stylesheet";
                el.href = assets[i];
                el.onload = onLoad;
                document.head.appendChild(el);
            })(document.createElement("link"), i);

        } else {
            ((img, i) => {
                img.src = assets[i];
                img.onload = onLoad;
            })(new Image(), i);
        }
    }
    
    
    
})();