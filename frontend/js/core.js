$( document ).ready(() => {

    let api_url = 'https://marcel-dorr.de/project-swm/api/';

    const $body =            $( 'body' );
    const $main =            $( '[content="main"]' );
    const $login =           $( '[login]' );
    const $register =        $( '[register]' );
    const $shoppingCart =    $( '[shopping-cart]' );
    const $bookInformation = $( '[book-information]' );
    const $container =       $( '[quick-category]' );

    let currentUtterance = null;

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

    const $moreButton = $('<div button="more"><i class="fa fa-caret-down" aria-hidden="true"></i></div>');
    $container.append($moreButton);

    $moreButton.on('click', showNextChunk);
    
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

    function generateRandomUsername() {
        const randomStr = Math.random().toString(36).substring(2, 8); // z. B. '5f3a9c'
        return 'user_' + randomStr;
    }

    $('[button="register:private"], [button="register:company"]').on("click", function (event) {
        const userType = $(event.currentTarget).is('[button="register:private"]') ? 'private' : 'company';
        let password1 = $('input[name="password-register-1"]').val();
        let password2 = $('input[name="password-register-2"]').val();

        if (password1 !== password2) {
            alert("Passwörter stimmen nicht überein.");
            return;
        }

        const data = {
            action: 'register',
            username: generateRandomUsername(),
            email: $('input[name="register-email"]').val(),
            password: password1,
            user_type: userType
        };

        fetch(api_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(async res => {
            const result = await res.json();

            if (!res.ok || result.success === false) {
                throw new Error(result.message || 'Fehler bei der Registrierung');
            }

            return result;
        })
        .then(result => {
            hideRegister();
            showLogin();
        })
        .catch(err => {
            alert(err.message);
        });
    });

    $('[button="login"]').on("click", async function () {
        const loginData = {
            action: 'login',
            email: $('div[login] input[name="email"]').val(),
            password: $('div[login] input[name="password"]').val()
        };

        fetch(api_url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(loginData)
        })
        .then(res => res.json())
        .then(result => {
            if (result.success) {
                sessionStorage.setItem('user', JSON.stringify(result.user)); 
                hideLogin();
                loadCart();
            } else {
                alert('Login fehlgeschlagen: ' + result.message);
            }
        })
        .catch(err => alert('Fehler: ' + err.message));
    });

    $(document).on('click', '[button="show:book-information"]', async function () {
        const bookId = $(this).attr('book-cover');
        const bookImage = String(bookId).padStart(3, '0');

        try {
            const res = await fetch(api_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'book', book_id: bookId })
            });

            if (!res.ok) throw new Error("Fehler beim Laden des Buchs");
            const book = await res.json();

            const categoryName = book.category_name || "Unbekannt";
            const price = parseFloat(book.price).toFixed(2);
            const oldPrice = book.old_price ? `<span old>${parseFloat(book.old_price).toFixed(2)}€</span>` : "";

            // ✅ Titel-Text prüfen, ob Buch schon im Warenkorb ist
            const bookTitle = book.title.trim();
            let alreadyInCart = false;

            $('[shopping-cart] [element] [text]').each(function () {
                const fullText = $(this).text().trim(); // z. B. "RomanDer kleine Prinz"
                if (fullText.includes(bookTitle)) {
                    alreadyInCart = true;
                    return false; // break loop
                }
            });

            const addToCartBtn = alreadyInCart
                ? `<div button disabled class="disabled">✔ Bereits im Warenkorb</div>`
                : `<div button="addto:shopping-cart" book-data="${book.book_id};${book.title};${categoryName};${price};1">+ Warenkorb</div>`;

            const bookHtml = `
                <div button="hide:book-information">
                    <i class="fa fa-times" aria-hidden="true"></i>
                </div>
                <div book-image style="background-image: url(./images/book_${bookImage}/front.png);">
                    <div book-autor></div>
                </div>
                <div book-info>
                    <div element>Author/in:<span>${book.author}</span></div>
                    <div element>Veröffentlichung:<span>${book.publication_year}</span></div>
                    <div element>Kategorie:<span>${categoryName}</span></div>
                    <div element>Seiten:<span>${book.page_count}</span></div>
                    <div element>Title:<span>${book.title}</span></div>
                    <div element>Preis:<span>${price}€ ${oldPrice}</span></div>
                    <div menu>
                        ${addToCartBtn}
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
            `;

            $('[book-information] > [form]').html(bookHtml);
            $('[book-information]').css('display', 'flex');

            $('[button]').on("click", function () {
                switch ($(this).attr('button')) {
                    case 'read:text':
                        const text = $('[book-description] > span').text().trim();
                        function speak(text) {
                            if (speechSynthesis.speaking) {
                                speechSynthesis.cancel();
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
        } catch (err) {
            console.error("Fehler beim Abrufen der Buchdetails:", err);
        }
    });

    $(document).on('click', '[button="hide:book-information"]', function () {
        $('[book-information]').hide();
        $('[book-information] > [form]').empty();
    });

    $('input[name="search"]').on('input', function () {
        const searchTerm = $(this).val().toLowerCase();

        $('div[article]').each(function () {
            const $article = $(this);
            const author = ($article.attr('author') || '').toLowerCase();
            const category = $article.find('div[category]').text().toLowerCase();
            const title = ($article.attr('title') || '').toLowerCase();
            const isbn = ($article.attr('isbn') || '').toLowerCase();
            const publisher = ($article.attr('publisher') || '').toLowerCase();
            const publication_year = ($article.attr('publication-year') || '').toLowerCase();

            const matches = [author, category, title, isbn, publisher, publication_year].some(field =>
                field.includes(searchTerm)
            );

            $article.toggle(matches);
        });
    });

    $(document).on('click', '[button^="addto:shopping-cart"]', async function () {
        const bookData = $(this).attr('book-data');
        if (!bookData) return;

        const storedUser = sessionStorage.getItem('user');
        if (!storedUser) return;

        const user = JSON.parse(storedUser);
        const [bookId, title, category, price] = bookData.split(';');
        const quantity = 1;
        const uniqueId = 'article_' + bookId;

        try {
            const res = await fetch(api_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'add_to_cart',
                    user_id: user.id,
                    book_id: bookId,
                    quantity: quantity
                })
            });

            const result = await res.json();

            if (result.success) {
                const $existing = $(`input[name="${uniqueId}"]`);
                if ($existing.length) {
                    let currentVal = parseInt($existing.val(), 10) || 1;
                    $existing.val(currentVal + 1);
                } else {
                    const elementHTML = `
                        <div element>
                            <div text><span>${category}</span>${title}</div>
                            <div placeholder></div>
                            <div price>${price}</div>
                            <div menu>
                                <input type="number" name="${uniqueId}" min="1" max="9999" value="1">
                                <div button="delete:${uniqueId}">
                                    <i class="fa fa-trash-o" aria-hidden="true"></i>
                                </div>
                            </div>
                        </div>
                    `;
                    $('div[shopping-cart] div[list]').append(elementHTML);
                    updateCart();
                }

                loadCart();

                // ⬇️ HIER wird der Button deaktiviert
                $(this).removeAttr('button')
                    .removeAttr('book-data')
                    .addClass('disabled')
                    .text('✔ Bereits im Warenkorb');
            } else {
                alert("Fehler: " + result.message);
            }

        } catch (err) {
            console.error("Fehler beim Hinzufügen zum Warenkorb:", err);
        }
    });

    $(document).on('click', '[button^="delete:"]', async function () {
        const storedUser = sessionStorage.getItem('user');
        if (!storedUser) {
            alert("Du bist nicht eingeloggt.");
            return;
        }

        const user = JSON.parse(storedUser);

        const buttonAttr = $(this).attr('button'); // z.B. delete:article_42
        const match = buttonAttr.match(/^delete:article_(\d+)$/);
        if (!match) return;

        const bookId = parseInt(match[1], 10);

        try {
            const res = await fetch(api_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'remove_from_cart',
                    user_id: user.id,
                    book_id: bookId
                })
            });

            const result = await res.json();

            if (result.success) {
                $(this).closest('[element]').remove();
                updateCart();
            } else {
                alert("Fehler beim Entfernen: " + result.message);
            }

        } catch (err) {
            console.error("Fehler beim Entfernen des Artikels:", err);
            alert("Verbindung zur API fehlgeschlagen.");
        }
    });

    $(document).on('change', 'div[shopping-cart] input[type="number"]', async function () {
        const storedUser = sessionStorage.getItem('user');
        if (!storedUser) {
            alert("Du bist nicht eingeloggt.");
            return;
        }

        const user = JSON.parse(storedUser);

        const $input = $(this);
        const nameAttr = $input.attr('name'); // z.B. article_42
        const match = nameAttr.match(/^article_(\d+)$/);
        if (!match) return;

        const bookId = parseInt(match[1], 10);
        const quantity = parseInt($input.val(), 10);

        if (isNaN(quantity) || quantity < 1) {
            alert("Ungültige Menge.");
            $input.val(1);
            return;
        }

        try {
            const res = await fetch(api_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_cart_quantity',
                    user_id: user.id,
                    book_id: bookId,
                    quantity: quantity
                })
            });

            const result = await res.json();

            if (!result.success) {
                alert("Fehler beim Aktualisieren: " + result.message);
            } else {
                updateCart(); // Optional: Gesamtpreis neu berechnen
            }

        } catch (err) {
            console.error("Fehler beim Aktualisieren der Menge:", err);
            alert("Serverfehler bei der Aktualisierung.");
        }
    });

    (async () => {
        try {
            // Alle Daten gleichzeitig über POST laden
            const [booksRes, categoriesRes, publishersRes] = await Promise.all([
                fetch(api_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'books' })
                }),
                fetch(api_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'categories' })
                }),
                fetch(api_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'publishers' })
                })
            ]);

            if (!booksRes.ok || !categoriesRes.ok || !publishersRes.ok) {
                throw new Error("Ein oder mehrere API-Aufrufe sind fehlgeschlagen.");
            }

            const books = await booksRes.json();
            const categories = await categoriesRes.json();
            const publishers = await publishersRes.json();

            // Caches vorbereiten
            const categoryCache = {};
            const publisherCache = {};

            // Caches füllen
            for (const cat of categories) {
                categoryCache[cat.category_id] = cat.name;
            }
            for (const pub of publishers) {
                publisherCache[pub.publisher_id] = pub.name;
            }

            // Buchliste rendern
            const $listContainer = $('[content="main"] > [top-list] > [list]');
            $listContainer.empty();

            for (const book of books) {
                const categoryName = categoryCache[book.category_id] || "Unbekannt";
                const publisherName = publisherCache[book.publisher_id] || "";

                const bookId = String(book.book_id).padStart(3, '0');
                const randomRate = (Math.random() * 4 + 1).toFixed(1);

                const $bookElement = $(`
                    <div article button="show:book-information" book-cover="${bookId}" isbn="${book.isbn}" author="${book.author}" publication-year="${book.publication_year}" publisher="${publisherName}" title="${book.title}">
                        <div category>${categoryName}</div>
                        <div rate>${randomRate}❤️</div>
                    </div>
                `);

                $listContainer.append($bookElement);
            }

            $('[article]').each(function () {
                const bookCover = $(this).attr('book-cover');
                $(this).css('background-image', 'url(./images/book_' + bookCover + '/front.png)');
            });

        } catch (err) {
            console.error("Fehler beim Laden der Daten:", err);
        }
    })();

    async function loadCart() {
        const storedUser = sessionStorage.getItem('user');
        const $cartList = $('div[shopping-cart] div[list]');
        $cartList.empty();

        if (!storedUser) {
            $cartList.append(`<div element><div text>Kein Benutzer eingeloggt – kein Warenkorb verfügbar.</div></div>`);
            return;
        }

        const user = JSON.parse(storedUser);

        try {
            const res = await fetch(api_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_cart',
                    user_id: user.id
                })
            });

            const result = await res.json();

            if (!result.success || !Array.isArray(result.cart) || result.cart.length === 0) {
                $cartList.append(`<div element><div text>Warenkorb ist leer.</div></div>`);
                return;
            }

            for (const item of result.cart) {
                const uniqueId = 'article_' + item.book_id;
                const category = item.category_name || 'Unbekannt';
                const title = item.title || '';
                const price = parseFloat(item.price).toFixed(2);
                const quantity = item.quantity || 1;

                const elementHTML = `
                    <div element>
                        <div text><span>${category}</span>${title}</div>
                        <div placeholder></div>
                        <div price>${price}</div>
                        <div menu>
                            <input type="number" name="${uniqueId}" min="1" max="9999" value="${quantity}">
                            <div button="delete:${uniqueId}">
                                <i class="fa fa-trash-o" aria-hidden="true"></i>
                            </div>
                        </div>
                    </div>
                `;
                $cartList.append(elementHTML);
            }

            updateCart();

        } catch (err) {
            console.error("Fehler beim Laden des Warenkorbs:", err);
            $cartList.append(`<div element><div text>Fehler beim Laden des Warenkorbs.</div></div>`);
        }
    }

    loadCart();
    
});