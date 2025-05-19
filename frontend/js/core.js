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

    $('[button="register:private"], [button="register:company"]').on("click", () => {
        const userType = $(this).is('[button="register:private"]') ? 'private' : 'company';

        if ($('input[name="password"]').val() !== $('input[name="passwordr"]').val()) {
            return
        }

        const data = {
            username: '---',
            email: $('input[name="email"]').val(),
            password: $('input[name="password"]').val(),
            user_type: userType,
            payment_method: 0
        };

        $.ajax({
            url: 'http://localhost:3000/api/v1/auth/register',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: res => {
                hideRegister();
                showLogin();
            },
            error: xhr => alert(xhr.responseJSON?.message || 'Fehler bei Registrierung')
        });
    });


    $('[button="login"]').on("click", function () {
        const data = {
            email: $('div[login] input[name="email"]').val(),
            password: $('div[login] input[name="password"]').val()
        };

        $.ajax({
            url: 'http://localhost:3000/api/v1/auth/login',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: res => {
                hideLogin();
            },
            error: xhr => alert(xhr.responseJSON?.message || 'Login fehlgeschlagen')
        });
    });

    $.ajax({
        url: "http://localhost:3000/api/books",
        method: "GET",
        success: function (data) {
            let listContainer = $('[content="main"] > [top-list] > [list]');
            listContainer.empty(); // vorherige Inhalte löschen

            data.forEach(book => {
                let bookElement = $(`
                    <div article button="show:book-information" book-cover="${book.id}">
                        <div category>${book.title}</div>
                        <div rate>${book.rating.toFixed(1)}❤️</div>
                    </div>
                `);
                listContainer.append(bookElement);
            });
        },
        error: function (err) {
            console.error("Fehler beim Laden der Bücher:", err);
        }
    });

    $(document).on('click', '[button="show:book-information"]', function () {
        const bookId = $(this).attr('book-cover');

        $.ajax({
            url: `http://localhost:3000/api/v1/books/${bookId}`,
            method: "GET",
            success: function (book) {
                const price = parseFloat(book.price).toFixed(2);
                const oldPrice = book.old_price ? `<span old>${parseFloat(book.old_price).toFixed(2)}€</span>` : "";

                const bookHtml = `
                    <div form>
                        <div button="hide:book-information">
                            <i class="fa fa-times" aria-hidden="true"></i>
                        </div>
                        <div book-image>
                            <div book-autor>${book.author}</div>
                        </div>
                        <div book-info>
                            <div element>Autor/in:<span>${book.author}</span></div>
                            <div element>Veröffentlichung:<span>${book.publication_year}</span></div>
                            <div element>Kategorie:<span>${book.category_name || 'Unbekannt'}</span></div>
                            <div element>Seiten:<span>${book.page_count}</span></div>
                            <div element>Title:<span>${book.title}</span></div>
                            <div element>Preis:<span>${price}€${oldPrice}</span></div>
                            <div menu>
                                <div button="addto:shopping-cart">+ Warenkorb</div>
                                <div button="addto:library">+ Bibliothek</div>
                            </div>
                        </div>
                        <div book-description>
                            Klappentext:<span>${book.description}</span>
                            <div menu>
                                <div button="read:text"><i class="fa fa-play"></i></div>
                                <div button="pause:text"><i class="fa fa-pause"></i></div>
                                <div button="resume:text"><i class="fa fa-play-circle"></i></div>
                                <div button="stop:text"><i class="fa fa-stop"></i></div>
                            </div>
                        </div>
                    </div>
                `;

                $('[book-information]').html(bookHtml).show();
            },
            error: function (err) {
                console.error("Fehler beim Abrufen der Buchdetails:", err);
            }
        });
    });

    $(document).on('click', '[button="hide:book-information"]', function () {
        $('[book-information]').hide().empty();
    });
});