$( document ).ready(() => {
    checkSession();

    const $body =            $( 'body' );
    const $main =            $( '[content="main"]' );
    const $login =           $( '[login]' );
    const $register =        $( '[register]' );
    const $shoppingCart =    $( '[shopping-cart]' );
    const $bookInformation = $( '[book-information]' );
    const $container =       $( '[quick-category]' );

    const chunkSize = 8;
    const $buttons = $container.children('div');
    let currentIndex = 0;
    $buttons.hide();

    function showNextChunk() {
        const $nextChunk = $buttons.slice(currentIndex, currentIndex + chunkSize);
        $nextChunk.show();
        currentIndex += chunkSize;
        if (currentIndex >= $buttons.length) {
            $( '[button="more"]' ).remove();
        }
    }

    showNextChunk();

    // Create and append "..." button
    const $moreButton = $('<div button="more"><i class="fa fa-caret-down" aria-hidden="true"></i></div>');
    $container.append($moreButton);

    // Click handler
    $moreButton.on('click', showNextChunk);
    
    let currentUtterance = null;
    $( '[button]' ).on( "click", function() {
        switch ($( this ).attr('button')) {
            case 'switch:background':
                switchBackground($body.attr('background'));
                break;
            case 'show:login':
                showLogin();
                break;
            case 'hide:login':
                hideLogin();
                break;
            case 'show:shopping-cart':
                showShoppingCart();
                break;
            case 'hide:shopping-cart':
                hideShoppingCart();
                break;
            case 'show:register':
                hideLogin();
                showRegister();
                break;
            case 'hide:register':
                hideRegister();
                break;
            case 'show:book-information':
                showBookInformation();
                $book_id = $( this ).attr('book-cover');
                console.log($book_id);
                break;
            case 'hide:book-information':
                hideBookInformation();
                break;
            case 'read:text':
                const text = $('[book-description] span').text().trim();
                function speak(text) {
                    if (speechSynthesis.speaking) {
                        speechSynthesis.cancel(); // ggf. laufende Ausgabe abbrechen
                    }
                    currentUtterance = new SpeechSynthesisUtterance(text);
                    currentUtterance.lang = 'de-DE';
                    const voices = speechSynthesis.getVoices();
                    const preferredVoice = voices.find(voice =>
                        voice.lang === 'de-DE' && /Google|Microsoft|Anna/.test(voice.name)
                    );
                    if (preferredVoice) {
                        currentUtterance.voice = preferredVoice;
                    }
                    speechSynthesis.speak(currentUtterance);
                }

                if (speechSynthesis.getVoices().length > 0) {
                    speak(text);
                } else {
                    speechSynthesis.onvoiceschanged = () => {
                        speak(text);
                    };
                }
                break;
            case 'pause:text':
                if (speechSynthesis.speaking && !speechSynthesis.paused) {
                    speechSynthesis.pause();
                }
                break;
            case 'resume:text':
                if (speechSynthesis.paused) {
                    speechSynthesis.resume();
                }
                break;
            case 'stop:text':
                if (speechSynthesis.speaking) {
                    speechSynthesis.cancel();
                }
                break;
        }
    });

    function switchBackground($id) {
        $random = Math.floor((Math.random() * 5) + 1);
        if ($id == $random) {
            switchBackground($id);
        }
        else {
            $body.attr('background', $random);
        }
    }

    function showLogin() {
        $login.css('display', 'flex');
    }

    function hideLogin() {
        $login.css('display', 'none');
    }

    function showShoppingCart() {
        $shoppingCart.css('display', 'flex');
    }

    function hideShoppingCart() {
        $shoppingCart.css('display', 'none');
    }

    function showRegister() {
        $register.css('display', 'flex');
    }

    function hideRegister() {
        $register.css('display', 'none');
    }

    function showBookInformation() {
        $bookInformation.css('display', 'flex');
    }

    function hideBookInformation() {
        $bookInformation.css('display', 'none');
    }

    function checkSession() {
        $.ajax({
            url: 'http://localhost/bookbay-api/checkSession.php',
            method: 'POST',
            xhrFields: {
                withCredentials: true
            },
            success: function (response) {
                console.log("Session-Check: ", response);
                // ggf. showLoginUI() oder redirect()
            },
            error: function (xhr, status, error) {
                console.error("Session-Check-Fehler:", error);
            }
        });
    }

    //------------------------------------------------------------------------
    //BUCH COVER

    $('[article]').each(function() {
        let bookCover = $(this).attr('book-cover');
        $(this).css('background-image', 'url(../images/book_' + bookCover + '/front.png)');
    });

    //------------------------------------------------------------------------

    function parsePrice(text) {
        return parseFloat(text.replace(',', '.').replace('€', '').trim());
    }

    function updateCart() {
        let totalPrice = 0;
        let totalCount = 0;

        $('[shopping-cart] > [form] > [list] > [element]').each(function () {
            let quantity = parseInt($(this).find('input[type="number"]').val(), 10);
            let priceText = $(this).find('[price]').text();
            let price = 0;
            if ($(this).find('[price] span[old]').length > 0) {
                let priceParts = priceText.split($(this).find('[price] span[old]').text());
                price = parsePrice(priceParts[1]);
            } else {
                price = parsePrice(priceText);
            }
            totalPrice += price * quantity;
            totalCount += quantity;
        });
        $('[result] span').text(totalPrice.toFixed(2).replace('.', ',') + '€');
        $('[button="show:shopping-cart"] [amount]').text(totalCount);
    }

    updateCart();

    $('[list]').on('change', 'input[type="number"]', function () {
        updateCart();
    });

    $('[list]').on('click', '[button^="delete:"]', function () {
        $(this).closest('[element]').remove();
        updateCart();
    });

    //---------------------------------------------------------

    $('[button="register:private"], [button="register:company"]').on("click", function () {
        const userType = $(this).is('[button="register:private"]') ? 'private' : 'company';

        const data = {
            action: 'register',
            email: $('input[name="email"]').val(),
            password: $('input[name="password"]').val(),
            passwordr: $('input[name="passwordr"]').val(),
            name: $('input[name="name"]').val(),
            postcode_city: $('input[name="postcode-city"]').val(),
            street_number: $('input[name="street-number"]').val(),
            type: userType
        };

        $.ajax({
            url: 'http://localhost/bookbay-api/register.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: res => {
                alert(res.message);
                // Zeige Login-Formular nach erfolgreicher Registrierung
            },
            error: xhr => alert(xhr.responseJSON?.message || 'Fehler bei Registrierung')
        });
    });


    $('[button="login"]').on("click", function () {
        const data = {
            action: 'login',
            email: $('div[login] input[name="email"]').val(),
            password: $('div[login] input[name="password"]').val()
        };

        $.ajax({
            url: 'http://localhost/bookbay-api/register.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: res => {
                alert(res.message);
                showUserUI(res.user); // z.B. Name anzeigen, Logout-Button zeigen
            },
            error: xhr => alert(xhr.responseJSON?.message || 'Login fehlgeschlagen')
        });
    });

fetch("http://localhost:3000/api/books").then(res => res.json().then(data => console.log(data)))
});