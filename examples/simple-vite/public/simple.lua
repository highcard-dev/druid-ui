local sp = "Some content"

Splash = {
    oninit = function ()
        print("This is the init function")

    end,
    view = function ()
        return d("div", {
            d("textarea", {
                onkeyup = function (e)
                    --local newContent = e.target.value
                    --setFileFromDeployment("server.properties", newContent):await()
                    print(e)
                    sp = e
                end,
            }, sp),
            d("br"),
            d("button", {
                onclick = function ()
                    print("Save button clicked")
                end,
            }, "Save"),
        })
    end,
}
mount(Splash)