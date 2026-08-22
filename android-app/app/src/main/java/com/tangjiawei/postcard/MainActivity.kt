package com.tangjiawei.postcard

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.tangjiawei.postcard.ui.PostcardApp
import com.tangjiawei.postcard.ui.PostcardTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PostcardTheme {
                PostcardApp()
            }
        }
    }
}
